import Discord from 'discord.js';
import GuildModel from '../../models/guild';
import PickupModel from '../../models/pickup';
import StatsModel from '../../models/stats';
import Bot from '../bot';
import GuildSettings from '../guildSettings';
import Logger from '../logger';
import PickupStage from '../PickupStage';
import PickupState from '../pickupState';
import { PendingPickup } from '../types';
import Util from '../util';

export const manualPicking = async (guild: Discord.Guild, pickupConfigId: number, firstRun = false) => {
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
    let captains: { id: string; nick: string }[] = [];

    const pickupChannel = await Util.getPickupChannel(guild);

    if (firstRun) {
        PickupState.removePlayersExclude(guild.id, [pickup.configId], pickup.players.map(p => p.id));

        // Choose captains, prioritize players with a captain role if available
        // Randomize order to make it fair
        const shuffledPlayers = Util.shuffleArray(players);

        // Go for role
        const captainRole = pickupSettings.captainRole;

        if (captainRole) {
            for (const player of shuffledPlayers) {
                const playerObj = await Util.getUser(guild, player.id) as Discord.GuildMember;

                // TODO: Check if members & roles are fetched correct now
                if (playerObj) {
                    if (playerObj.roles && playerObj.roles.cache.has(captainRole)) {
                        captains.push(player);
                        shuffledPlayers.splice(shuffledPlayers.findIndex(p => p === player), 1);
                    }
                }

                if (captains.length === maxCaps) {
                    break;
                }
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

                shuffledPlayers.splice(shuffledPlayers.findIndex(p => p.id === player.id), 1);

                if (captains.length === maxCaps) {
                    break;
                }
            }
        }

        // If there are still not enough captains, pick random captains
        if (captains.length < maxCaps) {
            for (const player of shuffledPlayers) {
                captains.push(player);
                shuffledPlayers.splice(shuffledPlayers.findIndex(p => p === player), 1);

                if (captains.length === maxCaps) {
                    break;
                }
            }
        }

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
                `Team picking for **${pickupSettings.name}** started\n` +
                `Players removed from other pickups\n\n` +
                `**Captains:** ${captains.map(captain => `<@${captain.id}>`).join(', ')}\n` +
                `**Left players:** ${shuffledPlayers.map(player => `<@${player.id}>`).join(', ')}\n\n` +
                `<@${captains[0].id}> got the first pick\n` +
                `Please pick your first player using **${guildSettings.prefix}pick @mention or id**`
            );
        }

        guildSettings.pendingPickups.set(pickupConfigId, setTimeout(() => manualPicking(guild, pickupConfigId), guildSettings.iterationTime));
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

            return await startPickup(guild, guildSettings, pendingPickup, pickupChannel, false, teams, captains);
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
                await manualPicking(guild, pickupConfigId);
            } catch (err) {
                Logger.logError('manual picking failed in picking timeout', err, false, guild.id, guild.name);
                return await startPickup(guild, guildSettings, pendingPickup, pickupChannel, true, null, null);
            }
        }, guildSettings.iterationTime);

        guildSettings.pendingPickups.set(pickupConfigId, timeout);
    }
}

const startPickup = async (guild: Discord.Guild, guildSettings: GuildSettings, pendingPickup: PendingPickup, pickupChannel: Discord.TextChannel, noTeams: boolean, teams?: bigint[][], captains?: any[]) => {
    const startWithoutTeams = async () => {
        try {
            if (pickupChannel) {
                pickupChannel.send(`something went wrong starting picked **pickup ${pendingPickup.name}**, attempting to start without teams`);
            }

            await PickupModel.clearTeams(BigInt(guild.id), pendingPickup.pickupConfigId);
            await PickupStage.startPickup(guild, pendingPickup.pickupConfigId)
        } catch (err) {
            Logger.logError('starting failed manual picking pickup failed', err, false, guild.id, guild.name);
            await PickupModel.resetPickup(BigInt(guild.id), pendingPickup.pickupConfigId);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong starting **pickup ${pendingPickup.name}** without teams, pickup cleared`);
            }
        }
    };

    if (!noTeams) {
        guildSettings.pendingPickups.delete(pendingPickup.pickupConfigId);

        try {
            await PickupModel.clearTeams(BigInt(guild.id), pendingPickup.pickupConfigId);
            await PickupStage.startPickup(guild, pendingPickup.pickupConfigId, teams, captains.map(c => BigInt(c.id)));
        } catch (err) {
            Logger.logError('starting manual picked pickup with teams failed', err, false, guild.id, guild.name);
            await startWithoutTeams();
        }
    } else {
        // For the exception case in the timeout
        await startWithoutTeams();
    }
}

export const abortPickingStagePickup = async (guildId: string, playerId: string) => {
    const bot = Bot.getInstance();
    const guild = bot.getClient().guilds.cache.get(guildId);
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
            .find(pickup => pickup.stage === 'picking_manual');

        if (!pending) {
            return;
        }

        pendingPickup = pending;

        guildSettings.pendingPickups.delete(pending.pickupConfigId);
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