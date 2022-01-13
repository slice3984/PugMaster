import Discord from 'discord.js';
import * as ts from 'ts-trueskill';
import PickupModel from '../../models/pickup';
import { PickupSettings, PickupStageType, PickupStartConfiguration } from '../types';

export const ratedTeams = async (guild: Discord.Guild, pickupSettings: PickupSettings, startCallback: (error: boolean,
    stage: PickupStageType,
    pickupSettings: PickupSettings,
    config: PickupStartConfiguration) => void) => {
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupSettings.id);

    const playerRatings = pickup.players.sort((a, b) => b.rating.mu - a.rating.mu);
    const teamIds: bigint[][] = [];
    const teamRatings: ts.Rating[][] = [];

    // More accurate team generation for 2 teams & <= 10 player pickups
    if (pickupSettings.teamCount === 2 && pickupSettings.playerCount <= 10) {
        const findMinDiffPartitions = (skills, t1 = [], t2 = []) => {
            const sum = arr => arr.reduce((acc, a) => acc + a.rating.mu, 0);

            if (skills.length <= 0) {
                return [t1, t2];
            }

            let a = findMinDiffPartitions(skills.slice(0, -1), t1.concat(skills.slice(-1).pop()), t2);
            let b = findMinDiffPartitions(skills.slice(0, -1), t1, t2.concat(skills.slice(-1).pop()));

            if (a[0].length != a[1].length) return b;
            if (b[0].length != b[1].length) return a;

            if (Math.abs(sum(a[0]) - sum(a[1])) < Math.abs(sum(b[0]) - sum(b[1]))) {
                return a;
            }

            return b;
        };

        const teams = findMinDiffPartitions(playerRatings);

        teams.forEach(team => {
            teamIds.push(team.map(p => BigInt(p.id)));
            teamRatings.push(team.map(p => p.rating));
        });
    } else {
        while (playerRatings.length > 0) {
            for (let team = 0; team < pickup.teams; team++) {
                if (!teamIds[team]) {
                    teamIds.push([]);
                    teamRatings.push([]);
                }

                const playerObj = playerRatings.shift();

                teamIds[team].push(BigInt(playerObj.id));
                teamRatings[team].push(playerObj.rating);

                if (playerRatings.length >= pickup.teams) {
                    const playerObj = playerRatings.pop();

                    teamIds[team].push(BigInt(playerObj.id));
                    teamRatings[team].push(playerObj.rating);
                }
            }
        }
    }

    const drawProbability = ts.quality(teamRatings);

    startCallback(false, 'elo', pickupSettings, {
        guild,
        pickupConfigId: pickupSettings.id,
        teams: teamIds,
        drawProbability
    });
}