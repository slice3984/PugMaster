import Discord, { GuildMember } from 'discord.js';
import PickupModel from "../models/pickup";
import PickupState from './pickupState';
import Util from './util';
import GuildModel from '../models/guild';
import StatsModel from '../models/stats';
import Bot from './bot';

export default class PickupStage {
    private constructor() { }


    static async handle(guild: Discord.Guild, pickupConfigId: number) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);

        // Afk check
        if (pickupSettings.afkCheck) {
            await PickupModel.setPending(BigInt(guild.id), pickupConfigId, 'afk_check');
            await PickupStage.afkCheckStage(guild, pickupConfigId, true);
            return;
        }

        // Pick mode
        switch (pickupSettings.pickMode) {
            case 'no_teams':
                PickupStage.startPickup(guild, pickupConfigId);
                break;
            case 'manual':

                break;
            case 'elo':
            // TODO: Generate teams and call startPickup with generated teams
        }
    }

    static async startPickup(guild: Discord.Guild, pickupConfigId: number, teams?: bigint[][], captains?: bigint[]) {
        const aboutToStart = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id), false)).values())
            .find(pickup => pickup.configId === pickupConfigId);

        const addedPlayers = aboutToStart.players.map(player => player.id);

        let players;

        if (teams) {
            players = teams;
        } else {
            players = addedPlayers;
        }

        // Remove players
        await PickupState.removePlayers(guild.id, true, pickupConfigId, ...addedPlayers);

        // Get & parse start message and display that
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), +aboutToStart.configId);
        const guildSettings = await GuildModel.getGuildSettings(guild);

        const startMessage = await Util.parseStartMessage(BigInt(guild.id), guildSettings.startMessage, pickupSettings, players);

        if (startMessage.length) {
            const pickupChannel = await Util.getPickupChannel(guild);
            await pickupChannel.send(startMessage);
            await PickupState.showPickupStatus(guild);
        }

        // DM players with enabled notifications
        const playersToDm = await GuildModel.getPlayersWithNotify(BigInt(guild.id), ...addedPlayers);

        if (playersToDm.length) {
            const dmMessage = await Util.parseNotifySubMessage(BigInt(guild.id), guildSettings.notifyMessage, pickupSettings);

            if (dmMessage.length) {
                for (const playerId of playersToDm) {
                    const member = guild.members.cache.get(playerId);
                    if (member) {
                        await member.send(dmMessage);
                    }
                }
            }
        }

        await StatsModel.storePickup(BigInt(guild.id), pickupConfigId, players, captains);
    }

    static async afkCheckStage(guild: Discord.Guild, pickupConfigId: number, firstRun = false) {
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

        const timestamp = new Date().getTime();

        for (const id of playerIds) {
            const user = (await Util.getUser(guild, id.toString()) as Discord.GuildMember);

            if (user) {
                if (user.lastMessage && ((user.lastMessage.createdTimestamp + guildSettings.afkTime) < timestamp)) {
                    afkPlayers.push(user);
                } else {
                    readyPlayers.push(user);
                }
            }
        }

        // No afk players, check if manual or elo pick mode is enabled
        if (!afkPlayers.length) {
            const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
            switch (pickupSettings.pickMode) {
                case 'no_teams':
                    return PickupStage.startPickup(guild, pickupConfigId);
                case 'elo':

                    break;
                case 'manual':

            }
        }

        // Set players afk in the db (Required for the ready command)
        await GuildModel.setAfks(BigInt(guild.id), ...afkPlayers.map(player => player.id));

        // Check if we reached the last iteration
        const pendingPickup = await GuildModel.getPendingPickup(BigInt(guild.id), pickupConfigId);

        if (!firstRun && guildSettings.afkCheckIterations === pendingPickup.currentIteration) {
            pickupChannel.send(`pickup **${pendingPickup.name}** aborted and AFK players removed`);

            await PickupModel.setPending(BigInt(guild.id), pickupConfigId, 'fill');
            await PickupState.removePlayers(guild.id, false, null, ...afkPlayers.map(player => player.id));
            await PickupState.showPickupStatus(guild);

            return;
        } else {
            const timeLeft = Util.formatTime((guildSettings.afkCheckIterations - pendingPickup.currentIteration) * guildSettings.iterationTime);
            pickupChannel.send(
                `**${pendingPickup.name}** is about to start\n` +
                (readyPlayers.length ? `Ready players: ${readyPlayers.map(player => `\`${player.displayName}\``).join(', ')}\n` : '') +
                `Please ${guildSettings.prefix}ready up: ${afkPlayers.join(', ')}\n` +
                `**${timeLeft}** left until the pickup gets aborted.`
            );
        }

        // Increment iteration & set new timeout for the specific guild
        await PickupModel.incrementPendingIteration(BigInt(guild.id), pickupConfigId);
        guildSettings.pendingPickups.set(pickupConfigId, setTimeout(() => PickupStage.afkCheckStage(guild, pickupConfigId), guildSettings.iterationTime));
    }
}