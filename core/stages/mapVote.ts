import Discord from 'discord.js';
import GuildModel from '../../models/guild';
import MappoolModel from '../../models/mappool';
import PickupModel from '../../models/pickup';
import StatsModel from '../../models/stats';
import Bot from '../bot';
import Logger from '../logger';
import PickupState from '../pickupState';
import { PendingPickup, PickupSettings, PickupStartConfiguration } from '../types';
import Util from '../util';

export const mapVote = async (guild: Discord.Guild, config: PickupStartConfiguration, pickupSettings: PickupSettings): Promise<{ error: string, map: string | null }> => {
    await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'mapvote');

    const bot = Bot.getInstance();
    const guildSettings = bot.getGuild(guild.id);
    const iterationTime = guildSettings.iterationTime;
    const iterations = guildSettings.mapvoteIterations;
    let iterationCount = 0;
    let firstRun = true;
    let results = [];

    guildSettings.pickupsInMapVoteStage.add(pickupSettings.id);

    const playedMaps = await StatsModel.getLastPlayedMaps(pickupSettings.id, 3);

    const poolName = await MappoolModel.getPoolName(BigInt(guild.id), pickupSettings.mapPoolId);
    const poolMaps: string[] = await MappoolModel.getMaps(BigInt(guild.id), poolName);

    let maps = poolMaps.filter(map => !playedMaps.includes(map));

    if (maps.length < 3) {
        maps = [...maps, ...poolMaps.filter(map => !maps.includes(map)).splice(0, 3 - maps.length)];
    }

    const players = config.teams.flat(2).map(p => p.toString());
    const voteMaps = Util.shuffleArray(maps).slice(0, 3);
    const availableReactions = voteMaps.length > 2 ? ['🇦', '🇧', '🇨'] : ['🇦', '🇧'];

    const pickupChannel = await Util.getPickupChannel(guild);

    const votes: { map: string; reaction: string; player: string[] }[] = [];

    for (let i = 0; i < availableReactions.length; i++) {
        votes.push({
            map: voteMaps[i],
            reaction: availableReactions[i],
            player: []
        });
    }

    const generateResults = () => {
        results = [];
        for (const vote of votes) {
            const percentage = Math.round(100 / (players.length / vote.player.length));
            results.push(`\`${vote.map}\` [${vote.player.length} vote${vote.player.length === 1 ? '' : 's'} / ${percentage}%]`);
        }
    }

    const showVote = async () => {
        let voteMessage;

        if (firstRun) {
            firstRun = false;
            voteMessage = `Pickup is about to start - map voting for pickup **${pickupSettings.name}** started - **${Util.formatTime(iterationTime * iterations)} left**\n` +
                `Please react accordingly to vote for your desired maps:\n` +
                `${players.map(p => `<@${p}>`).join(', ')}\n` +
                `Maps: ${availableReactions.map((r, idx) => `${r} ${voteMaps[idx]}`).join(' - ')}`;
        } else {
            generateResults();
            voteMessage = `Map voting for pickup **${pickupSettings.name}** in progress - **${Util.formatTime(iterationTime * (iterations - iterationCount))} left**\n` +
                `Results so far: ${results.join(' - ')}\n` +
                `Please react with ${availableReactions.join(', ')} if you didn't vote yet`;
        }

        const currentMessage = await pickupChannel.send(voteMessage);

        for (const reaction of availableReactions) {
            try {
                await currentMessage.react(reaction);
            } catch (err) {
                if (pickupChannel) {
                    pickupChannel.send('**Can\'t react to generated vote message, permissions missing?**');
                    return {
                        map: null,
                        error: 'permissions'
                    };
                }
            }
        }

        const collected = await currentMessage.awaitReactions({
            filter: (reaction, user) => {
                if (!availableReactions.includes(reaction.emoji.name) ||
                    !players.includes(user.id)) {
                    return false;
                }
                return true;
            }, time: iterationTime
        });

        // Aborted, server leave or admin action
        if (!guildSettings.pickupsInMapVoteStage.has(pickupSettings.id)) {
            return {
                map: null,
                error: 'aborted'
            };
        }

        for (const [reactionName, reaction] of collected.entries()) {
            for (const [userId, user] of reaction.users.cache) {
                // Initial bot reaction & votes of not added players
                if (userId === reaction.client.user.id || !players.includes(userId)) {
                    continue;
                }

                const vote = votes.find(vote => vote.reaction === reactionName);

                // Discard a vote if the player already voted for this map
                if (!vote.player.includes(userId)) {
                    vote.player.push(userId);
                }
            }
        }

        return {
            error: null,
            map: ''
        }
    };

    for (; iterationCount < iterations; iterationCount++) {
        const result = await showVote();

        if (result.error) {
            return result;
        }
    }

    // Vote done, determinate winner and show results
    let resultsStr = `**__Map voting done for pickup ${pickupSettings.name}__**\n**Results: **`;
    let winnerMap;

    generateResults();
    resultsStr += results.join(' - ');

    const sortedResults = votes.sort((v1, v2) => v2.player.length - v1.player.length);
    const winners = sortedResults.filter(vote => vote.player.length === sortedResults[0].player.length);

    // Multiple winners
    if (winners.length > 1) {
        winnerMap = winners.map(v => v.map)[Math.floor(Math.random() * winners.length)];
    } else {
        winnerMap = winners[0].map;
    }

    resultsStr += `\n**Chosen map:** \`${winnerMap}\`${winners.length > 1 ? ' (random of tied maps)' : ''}`;

    await pickupChannel.send(resultsStr);

    guildSettings.pickupsInMapVoteStage.delete(pickupSettings.id);
    return {
        error: null,
        map: winnerMap
    };
}

export const abortMapVoteStagePickup = async (guildId: string, playerId: string) => {
    const bot = Bot.getInstance();
    const guild = bot.getClient().guilds.cache.get(guildId as Discord.Snowflake);
    const guildSettings = bot.getGuild(guildId);
    const allPlayers = [];
    const pickupChannel = await Util.getPickupChannel(guild);

    let pendingPickup: PendingPickup | null;

    try {
        let pendingMap = await GuildModel.getPendingPickups(BigInt(guildId));

        if (!pendingMap) {
            return;
        }

        // Player can be only added to one pickup in picking stage
        let pending = pendingMap.get(guildId)
            .find(pickup => pickup.stage === 'mapvote');

        if (!pending) {
            return;
        }

        pendingPickup = pending;

        guildSettings.pickupsInMapVoteStage.delete(pendingPickup.pickupConfigId);

        // Players already in team
        allPlayers.push(...pendingPickup.teams.flatMap(t => t.players).map(p => p.id));

        // Left players
        allPlayers.push(...pendingPickup.playersLeft.map(p => p.id));

        await PickupModel.updatePlayerAddTimes(BigInt(guild.id), ...allPlayers);

        await PickupModel.abortPendingPickingPickup(BigInt(guild.id), pending.pickupConfigId, BigInt(playerId));

        if (pickupChannel) {
            pickupChannel.send(`**${pending.name}** aborted, players missing`);
            await PickupState.showPickupStatus(guild);
        }
    } catch (err) {
        Logger.logError('removing a player in map vote stage failed', err, false, guild.id, guild.name);
        // If there is no pending pickup, no modifications done anyway
        if (pendingPickup) {
            await PickupModel.resetPickup(BigInt(guild.id), pendingPickup.pickupConfigId);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong removing a player from **pickup ${pendingPickup.name}**, pickup cleared`);
            }
        }

    }
}