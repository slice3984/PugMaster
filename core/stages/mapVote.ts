import Discord, { ButtonInteraction, InteractionCollector, Message, MessageActionRow, MessageButton, MessageComponentInteraction, MessageOptions } from 'discord.js';
import * as progressBar from 'string-progressbar';
import GuildModel from '../../models/guild';
import MappoolModel from '../../models/mappool';
import PickupModel from '../../models/pickup';
import StatsModel from '../../models/stats';
import Bot from '../bot';
import Logger from '../logger';
import PickupState from '../pickupState';
import { PendingPickup, PickupSettings, PickupStartConfiguration } from '../types';
import Util, { debounce } from '../util';

export const mapVote = async (guild: Discord.Guild, config: PickupStartConfiguration, pickupSettings: PickupSettings): Promise<{ error: string, map: string | null }> => {
    await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'mapvote');

    let gotAborted = false;
    const bot = Bot.getInstance();
    const guildSettings = bot.getGuild(guild.id);
    const iterationTime = guildSettings.iterationTime;
    const iterations = guildSettings.mapvoteIterations;
    let iterationCount = 0;
    let collector: InteractionCollector<MessageComponentInteraction>;
    let currentMessage: Message;
    let modifiedVotes = false;
    let results: Map<string, number> = new Map();
    const votes: { map: string; player: string[] }[] = [];
    const unvoted: Map<string, string[]> = new Map();

    const playedMaps = await StatsModel.getLastPlayedMaps(pickupSettings.id, 3);

    const poolName = await MappoolModel.getPoolName(BigInt(guild.id), pickupSettings.mapPoolId);
    const poolMaps: string[] = await MappoolModel.getMaps(BigInt(guild.id), poolName);

    let maps = poolMaps.filter(map => !playedMaps.includes(map));

    if (maps.length < 3) {
        maps = [...maps, ...poolMaps.filter(map => !maps.includes(map)).splice(0, 3 - maps.length)];
    }

    const players = config.teams.flat(2).map(p => p.toString());
    const voteMaps = Util.shuffleArray(maps).slice(0, 3);

    const pickupChannel = await Util.getPickupChannel(guild);

    await PickupState.removePlayersExclude(guild.id, [config.pickupConfigId], players);

    voteMaps.forEach(map => {
        results.set(map, 0);
        unvoted.set(map, []);
    });

    const generateVoteMessage = (): MessageOptions => {
        // Message part
        const parts: string[] = [];

        if (iterationCount === 0) {
            parts.push(`Pickup is about to start - map voting for pickup **${pickupSettings.name}** started - **${Util.formatTime(iterationTime * iterations)} left**`);
            parts.push(`Please vote: ${players.map(p => `<@${p}>`).join(', ')}\n`)
        } else {
            parts.push(`Map voting for pickup **${pickupSettings.name}** in progress - **${Util.formatTime(iterationTime * (iterations - iterationCount))} left**\n`);
        }

        parts.push(generateResults());
        parts.push('Please vote using the buttons, you can vote for multiple maps.');
        parts.push('**You can only vote and unvote once per map.**');

        // Vote buttons
        const row = new MessageActionRow();

        const buttons = [];
        voteMaps.forEach(map => {
            buttons.push(
                new MessageButton()
                    .setCustomId(map)
                    .setLabel(map)
                    .setStyle('SUCCESS')
            )
        });

        row.addComponents(buttons);

        return { content: parts.join('\n'), components: [row] };
    };

    const updateVoteMessage = async () => {
        try {
            const msg = await currentMessage.fetch();
            currentMessage = await msg.edit(generateVoteMessage());
        } catch (_) { }
    };

    const generateResults = () => {
        let resultsStr = '**__Voting results__**\n\n';

        voteMaps.forEach(map => {
            const mapVote = votes.find(v => v.map === map);
            let bar;

            if (mapVote && mapVote.player.length) {
                bar = progressBar.filledBar(players.length, mapVote.player.length, 25, '░', '▓');
            } else {
                bar = progressBar.filledBar(players.length, 0, 25, '░', '▓');
            }

            resultsStr += `${bar[0]} ${bar[1]}% - ${map}\n`;
        });

        return resultsStr;
    };

    const removeMessage = async () => {
        if (collector) {
            try {
                collector.stop();

                if (currentMessage) {
                    const message = await currentMessage.fetch();
                    await message.delete();
                }
            } catch (_) { }
        }
    }

    const showVote = async () => {
        // Clear previous vote message
        await removeMessage();

        let voteMessage: MessageOptions;
        const row = new MessageActionRow();

        const buttons = [];
        voteMaps.forEach(map => {
            buttons.push(
                new MessageButton()
                    .setCustomId(map)
                    .setLabel(map)
                    .setStyle('SUCCESS')
            )
        });

        row.addComponents(buttons);

        voteMessage = generateVoteMessage();

        currentMessage = await pickupChannel.send(voteMessage);

        collector = currentMessage.createMessageComponentCollector();

        // Handle votes
        collector.on('collect', async (i: ButtonInteraction) => {

            if (!players.includes(i.user.id)) {
                return await i.deferUpdate();
            }

            const mapVotes = votes.find(v => v.map === i.customId);

            if (!mapVotes) {
                votes.push({
                    map: i.customId,
                    player: [i.user.id]
                });
                modifiedVotes = true;
            } else {
                // Check if the player already voted
                const playerIdx = mapVotes.player.findIndex(p => p === i.user.id);

                if (playerIdx > -1) {
                    // Remove vote, add to unvotes
                    mapVotes.player.splice(playerIdx, 1);
                    unvoted.get(i.customId).push(i.user.id);
                    modifiedVotes = true;
                } else {
                    // Only vote in case of first vote for this map
                    if (!unvoted.get(i.customId).includes(i.user.id)) {
                        mapVotes.player.push(i.user.id);
                        modifiedVotes = true;
                    }
                }
            }

            await i.deferUpdate();
        });

        const abortCb = async () => {
            gotAborted = true;
            clearInterval(refreshInterval);
            await removeMessage();
        }

        const refreshInterval = setInterval(async () => {
            if (modifiedVotes) {
                modifiedVotes = false;
                await updateVoteMessage();
            }
        }, 2000);

        guildSettings.pickupsInMapVoteStage.set(pickupSettings.id, abortCb);

        await delay(guildSettings.iterationTime);
        clearInterval(refreshInterval);

        // Aborted, server leave or admin action
        if (gotAborted) {
            return {
                map: null,
                error: 'aborted'
            };
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
    await removeMessage();
    const calcPercentage = (voteCount: number) => Math.round(100 / (players.length / voteCount));

    let resultsStr = `**__Map voting done for pickup ${pickupSettings.name}__**\n**Results: **`;
    let winnerMap;

    voteMaps.forEach(map => {
        if (!votes.find(vote => vote.map === map)) {
            votes.push({
                map,
                player: []
            })
        }
    });

    const sortedResults = votes.sort((v1, v2) => v2.player.length - v1.player.length);
    const winners = sortedResults.filter(vote => vote.player.length === sortedResults[0].player.length);

    resultsStr += sortedResults
        .map(result => `\`${result.map}\` [${result.player.length} vote${result.player.length > 1 || !result.player.length ? 's' : ''} / ${calcPercentage(result.player.length)}%]`).join(' - ');

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

const delay = (ms) => new Promise((resolve, reject) => setTimeout(resolve, ms));

export const abortMapVoteStagePickup = async (guildId: string, playerId: string) => {
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
            .find(pickup => pickup.stage === 'mapvote');

        if (!pending) {
            return;
        }

        pendingPickup = pending;

        const mapVoteAbortCb = guildSettings.pickupsInMapVoteStage.get(pendingPickup.pickupConfigId);

        if (mapVoteAbortCb) {
            await mapVoteAbortCb();
            guildSettings.pickupsInMapVoteStage.delete(pendingPickup.pickupConfigId);
        }

        const allPlayers = pendingPickup.players.map(p => p.id);

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