import Discord from 'discord.js';
import { Rating } from 'ts-trueskill';
import GuildModel from '../../models/guild';
import PickupModel from '../../models/pickup';
import StatsModel from '../../models/stats';
import Bot from '../bot';
import Logger from '../logger';
import PickupState from '../pickupState';
import { PendingPickup, PickupSettings, PickupStageType, PickupStartConfiguration } from '../types';
import Util from '../util';
import captainSelectionStage from './captainSelection';

export const manualPicking = async (guild: Discord.Guild, pickupConfigId: number, firstRun: boolean,
    startCallback: (error: boolean,
        stage: PickupStageType,
        pickupSettings: PickupSettings,
        config: PickupStartConfiguration) => void) => {
    // Abort if the stage changed
    if (!await PickupModel.isInStage(BigInt(guild.id), pickupConfigId, 'picking_manual')) {
        return;
    }

    const bot = Bot.getInstance();
    const guildSettings = bot.getGuild(guild.id);
    const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);
    const pendingPickup = await GuildModel.getPendingPickup(BigInt(guild.id), pickupConfigId);

    const players = pendingPickup.playersLeft;
    const maxCaps = pickupSettings.teamCount;
    let captains: { id: string; nick: string; rating?: Rating }[] = [];

    const pickupChannel = await Util.getPickupChannel(guild);

    if (firstRun) {
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
                if (playerObj.roles && playerObj.roles.cache.has(captainRole)) {
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
                        if (playerObj.roles && playerObj.roles.cache.has(captainRole)) {
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
                team: String.fromCharCode(65 + index),
                isCaptain: true,
                captainTurn: index ? false : true,
            }
        });

        // Store first teams (each captain belongs to a team)
        await PickupModel.addTeamPlayers(BigInt(guild.id), pickupConfigId, ...captainsObj);

        if (pickupChannel) {
            pickupChannel.send(
                `Team picking for **${pickupSettings.name}** started${pickupSettings.pickMode === 'autopick' ? ' - Maximum average player elo uncertainty exceeded for auto generated teams' : ''}\n` +
                `Players removed from other pickups\n\n` +
                `**Captains:** ${captains.map(captain => `<@${captain.id}>`).join(', ')}\n` +
                `**Left players:** ${shuffledPlayers.map(player => `<@${player.id}>`).join(', ')}\n\n` +
                `<@${captains[0].id}> got the first pick\n` +
                `Please pick your first player using **${guildSettings.prefix}pick @mention or id**`
            );
        }

        guildSettings.pendingPickups.set(pickupConfigId, setTimeout(async () => {
            try {
                await manualPicking(guild, pickupConfigId, false, startCallback);
            } catch (_) {
                return startCallback(true, 'manual', pickupSettings, {
                    guild,
                    pickupConfigId: pendingPickup.pickupConfigId,
                });
            }
        }, guildSettings.iterationTime));

    } else {
        const teams = pendingPickup.teams;

        let playersInTeams = pickupSettings.playerCount - pendingPickup.playersLeft.length;

        const leftPlayers = pendingPickup.playersLeft;

        const captains = pendingPickup.teams
            .map(team => team.players)
            .flat()
            .filter(player => player.isCaptain);

        const currentCaptain = captains.find(captain => captain.captainTurn);
        const currCaptainTeam = pendingPickup.teams.find(team => team.players.find(p => p.captainTurn)).name;

        // Check if teams are already picked
        if (playersInTeams + 1 === pickup.maxPlayers) {
            // Add the last player left to the team
            pendingPickup.teams.find(t => t.name === currCaptainTeam).players.push(pendingPickup.playersLeft[0]);

            // Teams are picked, start the pickup
            const teams: bigint[][] = pendingPickup.teams
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(team => team.players)
                .map(team => team.map(t => BigInt(t.id)));

            await PickupModel.clearTeams(BigInt(guild.id), pickupSettings.id);

            return startCallback(false, 'manual', pickupSettings, {
                guild,
                pickupConfigId: pendingPickup.pickupConfigId,
                teams,
                captains: captains.map(c => BigInt(c.id))
            });
        }

        // Check if the captain timed out
        if (pendingPickup.currentIteration === guildSettings.pickingIterations) {
            // Timed out, remove the captain and abort
            if (pickupChannel) {
                pickupChannel.send(
                    `**${pickup.name}** aborted, <@${currentCaptain.id}> didn't pick in time\n` +
                    `AFK captain removed`
                );
            }

            const allPlayers = [];

            // Players already in team
            allPlayers.push(...pendingPickup.teams.flatMap(t => t.players).map(p => p.id));

            // Left players
            allPlayers.push(...pendingPickup.playersLeft.map(p => p.id));

            await PickupModel.updatePlayerAddTimes(BigInt(guild.id), ...allPlayers);

            await PickupModel.abortPendingPickingPickup(BigInt(guild.id), pickupConfigId, BigInt(currentCaptain.id));
            await PickupState.showPickupStatus(guild);
            return;
        }

        const toPick = calculateLeftPicks(pendingPickup);

        let teamStr = '';
        const timeLeftStr = Util.formatTime((guildSettings.pickingIterations - pendingPickup.currentIteration) * guildSettings.iterationTime);

        for (const team of teams.sort((a, b) => a.name.localeCompare(b.name))) {
            teamStr += `**Team ${team.name}:** ${team.players.map(player => `\`${player.nick}\``).join(', ')}\n`;
        }

        if (pickupChannel) {
            pickupChannel.send(
                `<@${currentCaptain.id}> **please ${guildSettings.prefix}pick ${toPick > 1 ? 'two' : 'one'} player${toPick > 1 ? 's' : ''} for Team ${currCaptainTeam} @ ${pickup.name}**\n\n` +
                teamStr +
                `\n**Left players**: ${leftPlayers.map(player => `\`${player.nick}\``).join(', ')}\n` +
                `${timeLeftStr} left for the captain to pick until **${pickup.name}** gets aborted.`
            );
        }

        await PickupModel.incrementPendingIteration(BigInt(guild.id), pickupConfigId);

        const timeout = setTimeout(async () => {
            try {
                await manualPicking(guild, pickupConfigId, false, startCallback);
            } catch (err) {
                Logger.logError('manual picking failed in picking timeout', err, false, guild.id, guild.name);
                return startCallback(true, 'manual', pickupSettings, {
                    guild,
                    pickupConfigId: pendingPickup.pickupConfigId,
                });
            }
        }, guildSettings.iterationTime);

        guildSettings.pendingPickups.set(pickupConfigId, timeout);
    }
}

export const abortPickingStagePickup = async (guildId: string, playerId: string) => {
    const bot = Bot.getInstance();
    const guild = bot.getClient().guilds.cache.get(guildId);
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

        guildSettings.pendingPickups.delete(pending.pickupConfigId);

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

export const calculateLeftPicks = (pendingPickup: PendingPickup) => {
    const playersInTeams = pendingPickup.maxPlayers - pendingPickup.playersLeft.length;

    // Determinate the amount of picks
    let playersToPick = 1; // Default for first pick

    if (playersInTeams) {
        let leftPlayers = pendingPickup.maxPlayers - pendingPickup.teams.length;

        // First pick and last pick should be 1, if thats not the case, stick to 1 for every pick
        if ((pendingPickup.maxPlayers - 2) % pendingPickup.teams.length !== 0) {
            return playersToPick;
        }

        let maxToPick = 2;

        playersLoop:
        while (leftPlayers > 0) {
            for (let teamNum = 0; teamNum < pendingPickup.teams.length; teamNum++) {
                let toPick = Math.min(maxToPick, leftPlayers);

                if (leftPlayers === 2) {
                    toPick = 1;
                }

                for (let numPicked = 0; numPicked < toPick; numPicked++) {
                    if (leftPlayers - 1 == pendingPickup.playersLeft.length) {
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