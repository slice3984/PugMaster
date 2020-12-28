import Discord from 'discord.js';
import PickupModel from '../../models/pickup';
import Bot from '../bot';
import Logger from '../logger';
import PickupStage from '../PickupStage';
import Util from '../util';
import { manualPicking } from './manualPicking';
import { ratedTeams } from './ratedTeams';

export const autopick = async (guild: Discord.Guild, pickupConfigId: number) => {
    const maxAvgVariance = Bot.getInstance().getGuild(guild.id).maxAvgVariance;
    const pickupChannel = await Util.getPickupChannel(guild);
    const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);

    const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);
    const playerRatingVarianceAverage = pickup.players.map(p => p.rating.sigma)
        .reduce((prev, curr) => prev + curr, 0) / pickup.players.length;

    // Manual picking, average elo exceeded threshold
    if (Util.tsToEloNumber(playerRatingVarianceAverage) > maxAvgVariance) {
        try {
            await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'picking_manual');
            await manualPicking(guild, pickupSettings.id, true);
        } catch (err) {
            Logger.logError('manual picking failed in PickupStage', err, false, guild.id, guild.name);
            // Still attempt to start without teams
            try {
                Bot.getInstance().getGuild(guild.id).pendingPickups.delete(pickupSettings.id);

                if (pickupChannel) {
                    pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in picking phase, attempting to start without teams`);
                }

                await PickupModel.clearTeams(BigInt(guild.id), pickupSettings.id);
                await PickupStage.startPickup({ guild, pickupConfigId: pickupSettings.id });
            } catch (err) {
                Logger.logError('start attempt after failed picking failed in PickupStage', err, false, guild.id, guild.name);
                await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                if (pickupChannel) {
                    pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                }
            }
        }
    } else {
        try {
            await ratedTeams(guild, pickupSettings.id);
        } catch (err) {
            Logger.logError('rated team picking failed in PickupStage', err, false, guild.id, guild.name);
            try {
                // Start without teams
                if (pickupChannel) {
                    pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in rating based team generation, attempting to start without teams`);
                }

                await PickupStage.startPickup({ guild, pickupConfigId: pickupSettings.id });
            } catch (err) {
                Logger.logError('start attempt after failed rating based team generation failed in PickupStage', err, false, guild.id, guild.name);

                await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                if (pickupChannel) {
                    pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                }
            }
        }
    }
}