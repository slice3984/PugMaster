import Rating from '../core/rating';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'unrate',
    cooldown: 10,
    category: 'admin',
    shortDesc: 'Unrate a given pickup works upto 10 rated pickups in the past',
    desc: 'Unrate a given pickup works upto 10 rated pickups in the past',
    args: [
        { name: '<id>', desc: 'Id of the pickup unrate', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        if (!/^\d+$/.test(params[0])) {
            return message.reply('pickup id has to be a number');
        }

        const rateablePickup = await PickupModel.getStoredRateEnabledPickup(BigInt(message.guild.id), +params[0]);

        if (!rateablePickup) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no rateable pickup found with id **${params[0]}**`));
        }

        if (!rateablePickup.isRated) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, pickup **${rateablePickup.pickupId}** - **${rateablePickup.name}** is rateable but not rated yet`));
        }

        const success = await Rating.unrateMatch(message.guild.id, rateablePickup);

        if (!success) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you can only unrate up to ${Rating.RERATE_AMOUNT_LIMIT} proceeding rated pickups of the same kind`));
        }

        message.channel.send(Util.formatMessage('success', `Unrated pickup #**${rateablePickup.pickupId}** - **${rateablePickup.name}**`));
    }
}

module.exports = command;