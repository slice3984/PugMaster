import Discord from 'discord.js';
import PickupModel from '../../models/pickup';
import PickupStage from '../PickupStage';
import Util from '../util';

export const randomTeams = async (guild: Discord.Guild, pickupConfigId: number) => {
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);

    const players = Util.shuffleArray(pickup.players.map(p => BigInt(p.id)));
    const playersInTeam = pickup.maxPlayers / pickup.teams;
    const teams: bigint[][] = [];

    for (let i = 0; i < pickup.teams; i++) {
        teams.push(players.splice(0, playersInTeam));
    }

    await PickupStage.startPickup({ guild, pickupConfigId, teams });
}