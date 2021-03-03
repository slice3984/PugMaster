import Discord from 'discord.js';
import PickupModel from '../../models/pickup';
import Bot from '../bot';
import { PickupSettings, PickupStageType, PickupStartConfiguration } from '../types';
import Util from '../util';
import { manualPicking } from './manualPicking';
import { ratedTeams } from './ratedTeams';

export const autopick = async (guild: Discord.Guild, pickupSettings: PickupSettings, startCallback: (error: boolean,
    stage: PickupStageType,
    pickupSettings: PickupSettings,
    config: PickupStartConfiguration) => void) => {
    const maxAvgVariance = Bot.getInstance().getGuild(guild.id).maxAvgVariance;
    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupSettings.id);
    const playerRatingVarianceAverage = pickup.players.map(p => p.rating.sigma)
        .reduce((prev, curr) => prev + curr, 0) / pickup.players.length;

    // Manual picking, average elo exceeded threshold
    if (Util.tsToEloNumber(playerRatingVarianceAverage) > maxAvgVariance) {
        try {
            await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'picking_manual');
            await manualPicking(guild, pickupSettings.id, true, startCallback);
        } catch (_) {
            return startCallback(true, 'autopick', pickupSettings, {
                guild,
                pickupConfigId: pickupSettings.id,
            });
        }
    } else {
        try {
            await ratedTeams(guild, pickupSettings, startCallback);
        } catch (_) {
            return startCallback(true, 'autopick', pickupSettings, {
                guild,
                pickupConfigId: pickupSettings.id,
            });
        }
    }
}