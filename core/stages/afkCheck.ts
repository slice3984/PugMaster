import Discord, { GuildMember } from 'discord.js';
import GuildModel from '../../models/guild';
import PickupModel from '../../models/pickup';
import Bot from '../bot';
import Logger from '../logger';
import PickupStage from '../PickupStage';
import PickupState from '../pickupState';
import { GuildMemberExtended } from '../types';
import Util from '../util';

const afkCheckStage = async (guild: Discord.Guild, pickupConfigId: number, firstRun = false) => {
    // Abort if the stage changed
    if (!await PickupModel.isInStage(BigInt(guild.id), pickupConfigId, 'afk_check')) {
        return;
    }

    const bot = Bot.getInstance();
    const guildSettings = bot.getGuild(guild.id);
    const pickupChannel = await Util.getPickupChannel(guild);
    const readyPlayers: GuildMember[] = [];
    const afkPlayers: GuildMember[] = [];

    const playerIds = await (await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId))
        .players.map(player => player.id);

    if (firstRun) {
        const timestamp = new Date().getTime();

        for (const id of playerIds) {
            const user = (await Util.getUser(guild, id.toString()) as Discord.GuildMember);

            if (user) {
                const extendedGuildMember = (user as GuildMemberExtended);
                const messageTimestamp = 'lastMessageTimestamp' in extendedGuildMember ? extendedGuildMember.lastMessageTimestamp : null;

                if (messageTimestamp && ((messageTimestamp + guildSettings.afkTime) < timestamp)) {
                    afkPlayers.push(user);
                } else {
                    readyPlayers.push(user);
                }
            }
        }

        // Set players afk in the db (Required for the ready command and checks after the first run)
        if (afkPlayers.length) {
            await GuildModel.setAfks(BigInt(guild.id), ...afkPlayers.map(player => player.id));
        }
    } else {
        let updateDb = false;
        const timestamp = new Date().getTime();

        // Only use the stored afk players
        const afkPlayersDb = await GuildModel.getAfks(BigInt(guild.id), ...playerIds);

        for (const id of playerIds) {
            const user = (await Util.getUser(guild, id.toString()) as Discord.GuildMember) as GuildMemberExtended;

            if (user) {
                if (afkPlayersDb.includes(user.id)) {
                    // Maybe the player wrote a message, if thats the case add to ready players
                    const messageTimestamp = 'lastMessageTimestamp' in user ? user.lastMessageTimestamp : null;

                    if (messageTimestamp && ((messageTimestamp + guildSettings.afkTime) > timestamp)) {
                        readyPlayers.push(user);
                        updateDb = true;
                    } else {
                        afkPlayers.push(user);
                    }
                } else {
                    readyPlayers.push(user);
                }
            }
        }

        if (updateDb) {
            await GuildModel.removeAfks(null, BigInt(guild.id), ...readyPlayers.map(player => player.id));
        }
    }

    // No afk players, attempt to progress to the next stage
    if (!afkPlayers.length) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
        return await PickupStage.handleStart(guild, pickupSettings, pickupChannel);
    }

    // Check if we reached the last iteration
    const pendingPickup = await GuildModel.getPendingPickup(BigInt(guild.id), pickupConfigId);

    if (!firstRun && guildSettings.afkCheckIterations === pendingPickup.currentIteration) {
        await PickupModel.setPending(BigInt(guild.id), pickupConfigId, 'fill');
        await PickupState.removePlayers(guild.id, false, null, ...afkPlayers.map(player => player.id));
        await PickupState.showPickupStatus(guild);

        if (pickupChannel) {
            pickupChannel.send(`pickup **${pendingPickup.name}** aborted and AFK players removed`);
        }

        return;
    } else {
        const timeLeft = Util.formatTime((guildSettings.afkCheckIterations - pendingPickup.currentIteration) * guildSettings.iterationTime);

        if (pickupChannel) {
            pickupChannel.send(
                `**${pendingPickup.name}** is about to start\n` +
                (readyPlayers.length ? `Ready players: ${readyPlayers.map(player => `\`${player.displayName}\``).join(', ')}\n` : '') +
                `Please ${guildSettings.prefix}ready up: ${afkPlayers.join(', ')}\n` +
                `**${timeLeft}** left until the pickup gets aborted.`
            );
        }
    }

    // Increment iteration & set new timeout for the specific guild
    await PickupModel.incrementPendingIteration(BigInt(guild.id), pickupConfigId);

    const timeout = setTimeout(async () => {
        try {
            await afkCheckStage(guild, pickupConfigId);
        } catch (err) {
            Logger.logError('AFK check failed in timeout', err, false, guild.id, guild.name);
            await GuildModel.removeAfks(null, BigInt(guild.id), ...pendingPickup.players.map(p => p.id));

            // Don't attempt to start when players got removed
            const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);

            if (pickup.players.length !== pickup.maxPlayers) {
                // Reset pending iteration count & stage
                await PickupModel.setPending(BigInt(guild.id), pickupConfigId, 'fill');
                await PickupModel.resetPendingIteration(BigInt(guild.id), pickupConfigId);

                if (pickupChannel) {
                    pickupChannel.send(`afk check for **pickup ${pickup.name}** failed, players missing, not attempting to start`);
                }
            } else {
                // Start attempt
                if (pickupChannel) {
                    pickupChannel.send('afk check failed, attempting to progress to the next stage for the pickup without checking');
                }

                const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
                await PickupStage.handleStart(guild, pickupSettings, pickupChannel);
            }
        }
    }, guildSettings.iterationTime);

    guildSettings.pendingPickups.set(pickupConfigId, timeout);
}

export default afkCheckStage;