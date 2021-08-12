import Discord, { MessageActionRow, MessageEmbed, MessageSelectMenu, SelectMenuInteraction, TextChannel } from 'discord.js';
import { Rating } from 'ts-trueskill';
import GuildModel from '../../models/guild';
import PickupModel from '../../models/pickup';
import StatsModel from '../../models/stats';
import TeamModel from '../../models/teams';
import Bot from '../bot';
import Logger from '../logger';
import PickupState from '../pickupState';
import { PendingPickingGuildData, PendingPickup, PickupSettings, PickupStageType, PickupStartConfiguration } from '../types';
import Util from '../util';
import captainSelectionStage from './captainSelection';

export const manualPicking = async (guild: Discord.Guild, pickupConfigId: number, firstRun: boolean,
    startCallback: (error: boolean,
        stage: PickupStageType,
        pickupSettings: PickupSettings,
        config: PickupStartConfiguration) => void) => {

    // Abort if the stage changed
    if (!await PickupModel.isInStage(BigInt(guild.id), pickupConfigId, 'picking_manual')) {
        Bot.getInstance()
            .getGuild(guild.id).pendingPickingPickups
            .delete(pickupConfigId);
        return;
    }

    const bot = Bot.getInstance();
    const guildSettings = bot.getGuild(guild.id);

    let captains: { id: string; nick: string; rating?: Rating }[] = [];

    const pickupChannel = await Util.getPickupChannel(guild);

    if (firstRun) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
        const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);
        const pendingPickup = await GuildModel.getPendingPickup(BigInt(guild.id), pickupConfigId);
        const players = pendingPickup.players;
        const maxCaps = pickupSettings.teamCount;

        PickupState.removePlayersExclude(guild.id, [pickup.configId], pickup.players.map(p => p.id));
        // Choose captains, prioritize players with a captain role if available
        // Randomize order to make it fair
        const shuffledPlayers = Util.shuffleArray(players);

        if (pickupSettings.captainSelection === 'manual') {
            const pickedCaptains = await captainSelectionStage(guild, pendingPickup) as [] | boolean;

            // In case when the pickup got aborted
            if (pickedCaptains === false) {
                return;
            }

            if ((pickedCaptains as []).length) {
                (pickedCaptains as []).forEach(id => {
                    const player = shuffledPlayers.find(p => p.id === id);
                    captains.push({ id: player.id, nick: player.nick, rating: player.rating });
                })

                removeCaptainsFromPlayers(captains);
            }

            // In case of captain selection the stage changed, revert to manual picking
            await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'picking_manual');
        }

        function removeCaptainsFromPlayers(captains: { id: string }[]) {
            captains.forEach(cap => {
                const indexToRemove = shuffledPlayers.findIndex(p => p.id === cap.id);

                if (indexToRemove < 0) {
                    return;
                }

                shuffledPlayers.splice(indexToRemove, 1);
            });
        }

        const playerGotCaptainRole = async (playerId) => {
            const playerObj = await Util.getUser(guild, playerId) as Discord.GuildMember;

            if (playerObj) {
                if (playerObj.roles && playerObj.roles.cache.has(captainRole as Discord.Snowflake)) {
                    return true;
                } else {
                    return false;
                }
            }

            return false;
        }

        // Go for role
        const captainRole = pickupSettings.captainRole;
        if (captainRole && captains.length < maxCaps) {
            // If there is already at least one captain, find close ones
            if (captains.length) {
                const leftAvailableCaptains = [];

                for (const player of shuffledPlayers) {
                    if (await playerGotCaptainRole(player.id)) {
                        leftAvailableCaptains.push(player);
                    }
                }

                if (leftAvailableCaptains.length) {
                    while (leftAvailableCaptains.length && captains.length < maxCaps) {
                        let diff = Number.MAX_SAFE_INTEGER;
                        let cap = null;

                        leftAvailableCaptains.forEach((c, idx) => {
                            const lastAddedCap = captains[captains.length - 1];
                            const skillLastCap = lastAddedCap.rating.mu - 3 * lastAddedCap.rating.sigma;
                            const skillPossibleCap = c.rating.mu - 3 * c.rating.sigma;
                            const currDiff = Math.abs(skillLastCap - skillPossibleCap);

                            if (currDiff < diff) {
                                cap = c;
                                diff = currDiff;
                            }
                        });

                        captains.push({
                            id: cap.id,
                            nick: cap.nick,
                            rating: cap.rating
                        });

                        leftAvailableCaptains.splice(leftAvailableCaptains.findIndex(c => c === cap, 1));
                        diff = Number.MAX_SAFE_INTEGER;
                        cap = null;
                    }

                    removeCaptainsFromPlayers(captains);
                }
            } else {
                for (const player of shuffledPlayers) {
                    const playerObj = await Util.getUser(guild, player.id) as Discord.GuildMember;

                    // TODO: Check if members & roles are fetched correct now
                    if (playerObj) {
                        if (playerObj.roles && playerObj.roles.cache.has(captainRole as Discord.Snowflake)) {
                            captains.push(player);
                        }
                    }
                }

                // Get captains with smallest rating difference to each other
                if (captains.length > maxCaps) {
                    const sortedCaps = captains.sort((c1, c2) => {
                        const ratingC1 = c1.rating.mu - 3 * c1.rating.sigma;
                        const ratingC2 = c2.rating.mu - 3 * c2.rating.sigma;
                        return ratingC2 - ratingC1;
                    });

                    let newCaptains = [];
                    for (let i = 0; i < captains.length; i++) {
                        if (i + maxCaps > sortedCaps.length) {
                            break;
                        }

                        if (!newCaptains.length) {
                            newCaptains = sortedCaps.slice(i, i + maxCaps);
                            i += maxCaps - 2;
                        } else {
                            // Old diff
                            let oldDiff = 0;

                            newCaptains.forEach((cap, idx) => {
                                if (idx + 1 >= newCaptains.length) {
                                    return;
                                }

                                const nextCaptain = newCaptains[idx + 1];
                                const ratingCurr = cap.rating.mu - 3 * cap.rating.sigma;
                                const ratingNext = nextCaptain.rating.mu - 3 * nextCaptain.rating.sigma;

                                oldDiff += ratingCurr - ratingNext;
                            });

                            // New diff
                            const possibleCaps = sortedCaps.slice(i, i + maxCaps);
                            let newDiff = 0;

                            possibleCaps.forEach((cap, idx) => {
                                if (idx + 1 >= possibleCaps.length) {
                                    return;
                                }

                                const nextCaptain = possibleCaps[idx + 1];
                                const ratingCurr = cap.rating.mu - 3 * cap.rating.sigma;
                                const ratingNext = nextCaptain.rating.mu - 3 * nextCaptain.rating.sigma;

                                newDiff += ratingCurr - ratingNext;
                            });

                            if (oldDiff > newDiff) {
                                newCaptains = possibleCaps;
                            }
                        }
                    }

                    captains = newCaptains;
                }

                removeCaptainsFromPlayers(captains);
            }

        }

        // Go for pickup amount if captains are missing
        if (captains.length < maxCaps) {
            const amounts = await StatsModel.getPickupCountPlayers(BigInt(guild.id), pickupConfigId,
                ...shuffledPlayers.map(player => player.id));

            for (const player of amounts) {
                captains.push({
                    id: player.id,
                    nick: player.nick
                });

                removeCaptainsFromPlayers(captains);

                if (captains.length === maxCaps) {
                    break;
                }
            }
        }

        // If there are still not enough captains, pick random captains
        if (captains.length < maxCaps) {
            for (const player of shuffledPlayers) {
                captains.push(player);
                removeCaptainsFromPlayers(captains);

                if (captains.length === maxCaps) {
                    break;
                }
            }
        }

        // If there is only one captain with a captain role available the captain would always get first pick, randomize captains
        captains = Util.shuffleArray(captains);

        const captainsObj = captains.map((captain, index) => {
            return {
                id: BigInt(captain.id),
                nick: captain.nick,
                team: String.fromCharCode(65 + index),
                isCaptain: true,
                captainTurn: index ? false : true,
            }
        });

        if (pickupChannel) {
            const startMessage = await pickupChannel.send(`Team picking for pickup **${pickupSettings.name}** started!\n` +
                `${captains.map(captain => `<@${captain.id}>`).join(', ')} please pick in the attached thread.`);

            try {
                const teamAliases = await TeamModel.getTeams(BigInt(guild.id));

                const teams = [];

                captainsObj.forEach(cap => {
                    const teamAlias = teamAliases.find(alias => alias.teamId === cap.team);

                    teams.push({
                        team: cap.team,
                        teamAlias: teamAlias ? teamAlias.name : null,
                        captain: {
                            id: cap.id.toString(),
                            nick: cap.nick,
                            currentTurn: cap.captainTurn
                        },
                        players: [{ id: cap.id.toString(), nick: cap.nick }]
                    });
                });

                const pickingThread = await (pickupChannel as TextChannel).threads.create({
                    name: `Team picking - ${pickupSettings.name}`,
                    startMessage,
                    autoArchiveDuration: 60
                });

                const messageCollector = pickingThread.createMessageCollector()
                    .on('collect', m => {
                        if (m.author.id !== bot.getClient().application.id) {
                            m.delete();
                        }
                    });

                await pickingThread.setLocked(true);
                await pickingThread.setRateLimitPerUser(6 * 60 * 60);

                const successfullyFetched = await Util.getGuildMembers(guild, captains.map(c => c.id));

                successfullyFetched.forEach(c => {
                    try {
                        pickingThread.members.add(c);
                    } catch (_) { }
                })

                let teamLogEmbed = await generateTeamLog(teams, shuffledPlayers, pickupSettings.playerCount);

                const row = new Discord.MessageActionRow()
                    .addComponents(
                        await new MessageSelectMenu()
                            .setCustomId(pickingThread.id)
                            .setPlaceholder('Select a player to pick [1 to pick]')
                            .addOptions(await generateSelectMenuOptions(guild, shuffledPlayers.map(p => ({ id: p.id, nick: p.nick }))))
                    );


                let toSend = { embeds: [teamLogEmbed, generateTurnEmbed(captains[0].id, true)], components: [row] };

                const pickingMessage = await pickingThread.send(toSend);

                const selectCollector = pickingMessage.createMessageComponentCollector({ componentType: 'SELECT_MENU' });

                // Picks are handled here
                selectCollector.on('collect', async (i: SelectMenuInteraction) => {
                    const getLeftPicks = () => {
                        return (guildData.leftPlayers.length + guildData.teams.length) == guildData.maxPlayers ? 1 : calculateLeftPicks(guildData.maxPlayers, guildData.leftPlayers.length, guildData.teams.length);
                    }

                    const teams = guildData.teams;
                    const captains = teams.map(t => t.captain);

                    const gotCaptain = captains.find(c => c.id === i.user.id);

                    if (gotCaptain && gotCaptain.currentTurn) {
                        const currCaptainTeam = guildData.teams.find(t => t.captain.currentTurn);
                        const toPick = getLeftPicks();

                        // Remove from left players
                        const idx = guildData.leftPlayers.findIndex(p => p.id === i.values[0]);

                        currCaptainTeam.players.push(guildData.leftPlayers[idx]);
                        guildData.leftPlayers.splice(idx, 1);

                        await i.deferUpdate();

                        let pickingPlayer;

                        if (toPick === 1) {
                            // Next cap
                            currCaptainTeam.captain.currentTurn = false;
                            guildData.iterationTimeout.refresh();
                            guildData.currentIteration = 0;

                            await updateMessage(guildData, '', true);

                            // Get team
                            let nextTeam;

                            if (currCaptainTeam.team.charCodeAt(0) === 'A'.charCodeAt(0) + teams.length - 1) {
                                nextTeam = 'A';
                            } else {
                                nextTeam = String.fromCharCode(currCaptainTeam.team.charCodeAt(0) + 1);
                            }

                            const nextTeamCaptain = teams.find(t => t.team === nextTeam).captain;
                            nextTeamCaptain.currentTurn = true;

                            pickingPlayer = nextTeamCaptain.id;
                        } else {
                            // Same cap
                            pickingPlayer = currCaptainTeam.captain.id;
                        }

                        // Check if teams are already picked
                        if (!(guildData.leftPlayers.length - 1)) {
                            // Add the last player
                            teams.find(t => t.captain.currentTurn).players.push(guildData.leftPlayers[0]);
                            guildData.leftPlayers = [];

                            await guildData.botMessage.edit({
                                embeds: [
                                    await generateTeamLog(guildData.teams, guildData.leftPlayers, guildData.maxPlayers),
                                    new MessageEmbed()
                                        .setColor('#00ff00')
                                        .setTitle(`${Util.getBotEmoji('success')} **Picking done**`)
                                        .setDescription(`Pickup started in ${pickupChannel}`)
                                ], components: []
                            });

                            await updateMessage(guildData, '', true);

                            guildData.messageCollector.stop();
                            guildData.selectMenuCollector.stop();
                            await guildData.pickingThread.setArchived(true);

                            // Generate teams
                            const startTeams: bigint[][] = guildData.teams
                                .sort((a, b) => a.team.localeCompare(b.team))
                                .map(t => t.players)
                                .map(t => t.map(t => BigInt(t.id)));

                            clearTimeout(guildData.iterationTimeout);
                            guildSettings.pendingPickingPickups.delete(guildData.pickupConfigId);

                            // Start
                            return startCallback(false, 'manual', pickupSettings, {
                                guild,
                                pickupConfigId,
                                teams: startTeams,
                                captains: captains.map(c => BigInt(c.id))
                            });
                        } else {
                            const toPick = getLeftPicks();

                            await guildData.botMessage.edit({
                                embeds: [
                                    await generateTeamLog(guildData.teams, guildData.leftPlayers, guildData.maxPlayers),
                                    await generateTurnEmbed(pickingPlayer, toPick > 1 ? false : true)
                                ], components: [new MessageActionRow()
                                    .addComponents(
                                        new MessageSelectMenu()
                                            .setCustomId(pickingThread.id)
                                            .setPlaceholder(`Select a player to pick [${toPick} to pick]`)
                                            .addOptions(await generateSelectMenuOptions(guild, guildData.leftPlayers))
                                    )]
                            });
                        }
                    } else {
                        await i.deferUpdate();
                    }
                });

                const guildData: PendingPickingGuildData = {
                    maxPlayers: pickupSettings.playerCount,
                    name: pickupSettings.name,
                    currentIteration: 0,
                    teams,
                    leftPlayers: shuffledPlayers,
                    pickupConfigId: pickupConfigId,
                    pickingThread,
                    iterationTimeout: setTimeout(async () => {
                        try {
                            await manualPicking(guild, pickupConfigId, false, startCallback);
                        } catch (_) {
                            return startCallback(true, 'manual', pickupSettings, {
                                guild,
                                pickupConfigId: pendingPickup.pickupConfigId,
                            });
                        }
                    }, guildSettings.iterationTime),
                    botMessage: pickingMessage,
                    messageCollector,
                    selectMenuCollector: selectCollector,
                    optionalMessages: null
                };

                guildSettings.pendingPickingPickups.set(pickupConfigId, guildData);

            } catch (e) {
                pickupChannel.send(Util.formatMessage('error', 'Unable to create a picking thread, permissions missing? Picking aborted.'));
                throw e;
            }
        }
    } else {
        const guildData = guildSettings.pendingPickingPickups.get(pickupConfigId);
        const teams = guildData.teams;
        const currentCaptainTeam = teams.find(t => t.captain.currentTurn);

        // Check if the picking thread is still there
        try {
            await guildData.pickingThread.fetch();
        } catch (e) {
            guildSettings.pendingPickingPickups.delete(pickupConfigId);

            if (pickupChannel) {
                pickupChannel.send(Util.formatMessage('error', `Picking thread not found, picking aborted.`));
            }

            throw e;
        }

        // Check if the captain timed out
        if (guildData.currentIteration === guildSettings.pickingIterations) {
            // Delete messages, stop collectors, generate abort embed
            guildData.messageCollector.stop();
            guildData.selectMenuCollector.stop();
            guildSettings.pendingPickingPickups.delete(pickupConfigId);

            try {
                await updateMessage(guildData, '', true);

                await guildData.botMessage.edit({
                    embeds: [
                        new Discord.MessageEmbed()
                            .setColor('#ff0000')
                            .setTitle(`${Util.getBotEmoji('error')} **Aborted**`)
                            .setDescription(`<@${currentCaptainTeam.captain.id}> didn't pick in time.\n` +
                                `Pickup **${guildData.name}** aborted and AFK captain removed.`
                            )
                    ], components: []
                });

                await guildData.pickingThread.setArchived(true, 'Captain timeout, aborted.');

                if (pickupChannel) {
                    pickupChannel.send(
                        `**${guildData.name}** aborted, <@${currentCaptainTeam.captain.id}> didn't pick in time\n` +
                        `AFK captain removed`
                    );
                }

            } catch (e) {
                if (pickupChannel) {
                    await pickupChannel.send(Util.formatMessage('error', `Failed to edit or archive the picking thread, permissions missing?`));
                }
            }

            const allPlayers = [];

            // In team
            allPlayers.push(...teams.flatMap(t => t.players).map(p => p.id));

            // Left
            allPlayers.push(...guildData.leftPlayers.map(p => p.id));

            await PickupModel.updatePlayerAddTimes(BigInt(guild.id), ...allPlayers);
            await PickupModel.abortPendingPickingPickup(BigInt(guild.id), pickupConfigId, BigInt(currentCaptainTeam.captain.id));
            await PickupState.showPickupStatus(guild);
            return;
        }

        const timeLeftStr = Util.formatTime((guildSettings.pickingIterations - guildData.currentIteration) * guildSettings.iterationTime);
        const toPick = (guildData.leftPlayers.length + guildData.teams.length) == guildData.maxPlayers ? 1 : calculateLeftPicks(guildData.maxPlayers, guildData.leftPlayers.length, guildData.teams.length);

        const pickStr = `\n<@${currentCaptainTeam.captain.id}> **please pick ${toPick > 1 ? 'two' : 'one'} player${toPick > 1 ? 's' : ''} ` +
            `for Team ${currentCaptainTeam.teamAlias ? currentCaptainTeam.teamAlias : currentCaptainTeam.team} @ ${guildData.name}**\n` +
            `**${timeLeftStr}** left until ${guildData.name} gets aborted.`;

        await updateMessage(guildData, pickStr);
        guildData.currentIteration++;

        const timeout = setTimeout(async () => {
            try {
                await manualPicking(guild, pickupConfigId, false, startCallback);
            } catch (err) {
                clearTimeout(guildData.iterationTimeout);
                guildSettings.pendingPickingPickups.delete(pickupConfigId);
                Logger.logError('manual picking failed in picking timeout', err, false, guild.id, guild.name);
                const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
                return startCallback(true, 'manual', pickupSettings, {
                    guild,
                    pickupConfigId: pickupSettings.id,
                });
            }
        }, guildSettings.iterationTime);

        guildData.iterationTimeout = timeout;
    }
}

export const abortPickingStagePickup = async (guildId: string, playerId: string) => {
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
            .find(pickup => pickup.stage === 'picking_manual');

        if (!pending) {
            return;
        }

        pendingPickup = pending;

        // Archive the thread, disable collector
        const guildData = guildSettings.pendingPickingPickups.get(pending.pickupConfigId);

        guildData.messageCollector.stop();
        guildData.selectMenuCollector.stop();
        clearTimeout(guildData.iterationTimeout);
        guildSettings.pendingPickingPickups.delete(pending.pickupConfigId);

        try {
            await updateMessage(guildData, '', true);

            await guildData.botMessage.edit({
                embeds: [new Discord.MessageEmbed()
                    .setColor('#ff0000')
                    .setTitle(`${Util.getBotEmoji('error')} **Aborted**`)
                    .setDescription(`Players missing for picking, pickup **${pending.name}** aborted.`)],
                components: []
            });
            await guildData.pickingThread.setArchived(true, 'Player missing, aborted.');
        } catch (_) {
            if (pickupChannel) {
                await pickupChannel.send(Util.formatMessage('error', `Failed to edit or archive the picking thread, permissions missing?`))
            }
        }

        // In team
        allPlayers.push(...guildData.teams.flatMap(t => t.players).map(p => p.id));

        // Left
        allPlayers.push(...guildData.leftPlayers.map(p => p.id));

        await PickupModel.updatePlayerAddTimes(BigInt(guild.id), ...allPlayers);
        await PickupModel.abortPendingPickingPickup(BigInt(guild.id), pending.pickupConfigId, BigInt(playerId));

        if (pickupChannel) {
            pickupChannel.send(`**${pending.name}** aborted, players missing`);
            await PickupState.showPickupStatus(guild);
        }
    } catch (err) {
        const pendingObj = guildSettings.pendingPickingPickups.get(pendingPickup.pickupConfigId);

        if (pendingObj) {
            clearTimeout(guildSettings.pendingPickingPickups.get(pendingPickup.pickupConfigId).iterationTimeout);
            guildSettings.pendingPickingPickups.delete(pendingPickup.pickupConfigId);

        }

        Logger.logError('removing a player in manual picking stage failed', err, false, guild.id, guild.name);
        // If there is no pending pickup, no modifications done anyway
        if (pendingPickup) {
            await PickupModel.resetPickup(BigInt(guild.id), pendingPickup.pickupConfigId);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong removing a player from **pickup ${pendingPickup.name}**, pickup cleared`);
            }
        }
    }
}

const generateTeamLog = async (
    teams: { team: string; captain: { id: string; nick: string; }; teamAlias: string; players: { id: string; nick: string; }[] }[],
    leftPlayers: { id: string; nick: string; }[],
    maxPlayers: number): Promise<Discord.MessageEmbed> => {
    const embedTeams = [];
    const playersPerTeam = maxPlayers / teams.length;

    teams.forEach(team => {
        // Don't modify the ref, clone the array
        const playersCopy = team.players.slice();
        const rows: Discord.EmbedFieldData[] = [];
        const teamName = team.teamAlias || team.team;

        // | ___ | Team name - Captain name| ___|
        rows[0] = { name: '\u200B', value: `Team **${teamName}**`, inline: true };
        rows[1] = { name: '\u200B', value: `Captain: **${team.captain.nick}**`, inline: true };
        rows[2] = { name: '\u200B', value: `\u200B`, inline: true };
        rows[3] = { name: '\u200B', value: '', inline: true };
        rows[4] = { name: '\u200B', value: '', inline: true };
        rows[5] = { name: '\u200B', value: '', inline: true };

        let colIdx = 3;
        for (let i = 0; i < playersPerTeam; i++) {
            if (!playersCopy.length) {
                rows[colIdx].value += '-\n';
            } else {
                rows[colIdx].value += `${playersCopy.shift().nick}\n`;
            }

            if (colIdx === 5) {
                colIdx = 3;
            } else {
                colIdx++;
            }
        }

        embedTeams.push(rows);
    });

    const fields = embedTeams.flat();

    if (leftPlayers.length) {
        fields.push({ name: 'Left players', value: leftPlayers.map(p => p.nick).join(', '), inline: false });
    }

    return new Discord.MessageEmbed()
        .setColor('#126e82')
        .setTitle('Team Log')
        .addFields(fields);
}

const generateTurnEmbed = (playerId: string, pickOne: boolean): Discord.MessageEmbed => {
    return new Discord.MessageEmbed()
        .setColor('#126e82')
        .setTitle(`${Util.getBotEmoji('info')} **Turn**`)
        .setDescription(`<@${playerId}> please pick **${pickOne ? 'one' : 'two'} player${pickOne ? '' : 's'}**`);
}

const generateSelectMenuOptions = async (guild: Discord.Guild, players: { id: string; nick: string }[]): Promise<Discord.MessageSelectOptionData[]> => {
    const options: Discord.MessageSelectOptionData[] = [];

    const members = await Util.getGuildMembers(guild, players.map(p => p.id));

    for (const player of players) {
        const member = members.find(m => m.id === player.id);

        options.push({
            label: player.nick,
            description: member ? member.user.tag : '-',
            value: player.id
        });
    }

    return options;
};

const updateMessage = async (data: PendingPickingGuildData, newMessage: string, onlyDelete = false) => {
    if (data.optionalMessages) {
        try {
            const msg = await data.optionalMessages.fetch();

            if (msg.deletable) {
                await msg.delete();
            }

            data.optionalMessages = null;

            if (onlyDelete) {
                return;
            }

            data.optionalMessages = await data.pickingThread.send(newMessage);
        } catch (_) {
            // Not there anymore
            data.optionalMessages = null;

            if (!onlyDelete) {
                data.optionalMessages = await data.pickingThread.send(newMessage);
            }
        }
    } else {
        if (onlyDelete) {
            return;
        }

        data.optionalMessages = await data.pickingThread.send(newMessage);
    }
}

export const calculateLeftPicks = (maxPlayers: number, leftPlayersCount: number, teamCount: number) => {
    const playersInTeams = maxPlayers - leftPlayersCount;

    // Determinate the amount of picks
    let playersToPick = 1; // Default for first pick

    if (playersInTeams) {
        let leftPlayers = maxPlayers - teamCount;

        // First pick and last pick should be 1, if thats not the case, stick to 1 for every pick
        if ((maxPlayers - 2) % teamCount !== 0) {
            return playersToPick;
        }

        let maxToPick = 2;

        playersLoop:
        while (leftPlayers > 0) {
            for (let teamNum = 0; teamNum < teamCount; teamNum++) {
                let toPick = Math.min(maxToPick, leftPlayers);

                if (leftPlayers === 2) {
                    toPick = 1;
                }

                for (let numPicked = 0; numPicked < toPick; numPicked++) {
                    if (leftPlayers - 1 == leftPlayersCount) {
                        playersToPick = toPick - numPicked;
                        break playersLoop;
                    }
                    leftPlayers--;
                }
            }
        }
    }
    return playersToPick;
}