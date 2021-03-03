import Discord from 'discord.js';
import PickupModel from '../../models/pickup';
import { PickupStageType, PickupSettings, PickupStartConfiguration } from '../types';
import Util from '../util';

export const randomTeams = async (guild: Discord.Guild, pickupSettings: PickupSettings,
    startCallback: (error: boolean,
        stage: PickupStageType,
        pickupSettings: PickupSettings,
        config: PickupStartConfiguration) => void) => {
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupSettings.id);

    const players = Util.shuffleArray(pickup.players.map(p => BigInt(p.id)));
    const playersInTeam = pickup.maxPlayers / pickup.teams;
    const teams: bigint[][] = [];

    for (let i = 0; i < pickup.teams; i++) {
        teams.push(players.splice(0, playersInTeam));
    }

    startCallback(false, 'random', pickupSettings, {
        guild,
        pickupConfigId: pickupSettings.id,
        teams
    });
}