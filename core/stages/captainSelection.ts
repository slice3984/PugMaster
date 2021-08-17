import Discord, { GuildMember } from 'discord.js';
import GuildModel from '../../models/guild';
import PickupModel from '../../models/pickup';
import Bot from '../bot';
import Logger from '../logger';
import PickupState from '../pickupState';
import { PendingPickup } from '../types';
import Util from '../util';
const captainSelectionStage = (guild: Discord.Guild, pickup: PendingPickup) =>
    new Promise(async resolve => {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickup.pickupConfigId);
        const bot = Bot.getInstance();
        const guildSettings = bot.getGuild(guild.id);
        const iterationTime = guildSettings.iterationTime;
        const iterations = guildSettings.captainSelectionIterations;
        const pickupChannel = await Util.getPickupChannel(guild);
        const availableCaptains = [];
        const captains = [];
        let isDone = false;

        let iterationCount = 0;
        let firstRun = true;

        const captainRole = pickupSettings.captainRole;

        // Abort if no captain role available or no suitable players added
        if (!captainRole) {
            return resolve([]);
        }

        for (const player of pickup.players) {
            const playerObj = await Util.getUser(guild, player.id) as Discord.GuildMember;

            if (playerObj) {
                if (playerObj.roles && playerObj.roles.cache.has(captainRole as Discord.Snowflake)) {
                    availableCaptains.push(playerObj);
                }
            }
        }

        if (!availableCaptains.length) {
            return resolve([]);
        }

        await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'captain_selection');


        // Required for cap command
        const update = (userId: string, abort: boolean) => {
            if (abort) {
                isDone = true;
                return resolve(false);
            }

            if (availableCaptains.map(c => c.id).includes(userId)) {
                if (captains.map(c => c.id).includes(userId)) {
                    captains.splice(captains.findIndex(c => c.id === userId), 1);
                    return Util.formatMessage('success', `<@${userId}>, you are not a captain for pickup **${pickupSettings.name}** anymore`);
                }

                captains.push(availableCaptains.find(c => c.id === userId));
                if (captains.length === pickupSettings.teamCount || availableCaptains.length === captains.length) {
                    done();
                } else {
                    return Util.formatMessage('success', `<@${userId}>, assigned you as captain for pickup **${pickupSettings.name}**`);
                }

            } else {
                if (pickup.players.map(p => p.id).includes(userId)) {
                    return Util.formatMessage('error', `<@${userId}>, only players with captain role are able to cap`);

                } else {
                    return Util.formatMessage('error', `<@${userId}>, you are not added to pickup **${pickupSettings.name}**`);
                }
            }
        }

        guildSettings.captainSelectionUpdateCbs.set(pickupSettings.id, update);

        const done = () => {
            guildSettings.captainSelectionUpdateCbs.delete(pickupSettings.id);
            isDone = true;
            resolve(captains.map(c => c.id));
        };

        const iteration = async () => {
            let msg;

            if (firstRun) {
                firstRun = false;
                msg = `Pickup is about to start - captain selection for pickup **${pickupSettings.name}** started - **${Util.formatTime(iterationTime * iterations)} left**\n`
                    + `Please ${guildSettings.prefix}cap to become a captain.\n` +
                    `Available captains: ${availableCaptains.join(', ')}`;
            } else {
                msg = `Captain selection for pickup **${pickupSettings.name}** in progress - **${Util.formatTime(iterationTime * (iterations - iterationCount))} left**\n` +
                    `Current captains: ${captains.length ? captains.map(c => `\`${c.displayName}\``).join(', ') : '-'}`;
            }

            pickupChannel.send(msg);
            await new Promise(resolve => setTimeout(resolve, iterationTime));

            if ((iterationCount + 1) === iterations) {
                return done();
            }
        }

        for (; iterationCount < iterations; iterationCount++) {
            if (!isDone) {
                await iteration();
            }
        }
    });

export const abortCaptainSelectionStagePickup = async (guildId: string, playerId: string) => {
    const bot = Bot.getInstance();
    const guild = bot.getClient().guilds.cache.get(guildId as Discord.Snowflake);
    const guildSettings = bot.getGuild(guildId);
    const pickupChannel = await Util.getPickupChannel(guild);

    let pendingPickup: PendingPickup | null;

    try {
        let pendingMap = await GuildModel.getPendingPickups(BigInt(guildId));

        if (!pendingMap) {
            return;
        }

        // Player can be only added to one pickup in picking stage
        let pending = pendingMap.get(guildId)
            .find(pickup => pickup.stage === 'captain_selection');

        if (!pending) {
            return;
        }

        pendingPickup = pending;

        const updateCb = guildSettings.captainSelectionUpdateCbs.get(pendingPickup.pickupConfigId);
        updateCb(null, true);

        await PickupModel.updatePlayerAddTimes(BigInt(guild.id), ...pendingPickup.players.map(p => p.id));
        await PickupModel.abortPendingPickingPickup(BigInt(guild.id), pending.pickupConfigId, BigInt(playerId));

        if (pickupChannel) {
            pickupChannel.send(`**${pending.name}** aborted, players missing`);
            await PickupState.showPickupStatus(guild);
        }
    } catch (err) {
        Logger.logError('removing a player in captain selection stage failed', err, false, guild.id, guild.name);
        // If there is no pending pickup, no modifications done anyway
        if (pendingPickup) {
            await PickupModel.resetPickup(BigInt(guild.id), pendingPickup.pickupConfigId);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong removing a player from **pickup ${pendingPickup.name}**, pickup cleared`);
            }
        }

    }
}

export default captainSelectionStage;
