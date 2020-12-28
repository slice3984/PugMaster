import Discord from 'discord.js';
import * as ts from 'ts-trueskill';
import PickupModel from '../../models/pickup';
import PickupStage from '../PickupStage';

export const ratedTeams = async (guild: Discord.Guild, pickupConfigId: number) => {
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);

    const playerRatings = pickup.players.sort((a, b) => b.rating.mu - a.rating.mu);
    const teamIds: bigint[][] = [];
    const teamRatings: ts.Rating[][] = [];

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

    const drawProbability = ts.quality(teamRatings);
    await PickupStage.startPickup({ guild, pickupConfigId, teams: teamIds, drawProbability });
}