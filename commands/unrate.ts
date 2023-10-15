import { EmbedBuilder } from 'discord.js';
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
            return Util.send(message, 'error', 'pickup id has to be a number');
        }

        const rateablePickup = await PickupModel.getStoredRateEnabledPickup(BigInt(message.guild.id), +params[0]);

        if (!rateablePickup) {
            return Util.send(message, 'error', `no rateable pickup found with id **${params[0]}**`);
        }

        if (!rateablePickup.isRated) {
            return Util.send(message, 'error', `pickup **${rateablePickup.pickupId}** - **${rateablePickup.name}** is rateable but not rated yet`);
        }

        const toSend = await Rating.unrateMatch(message.guild.id, rateablePickup);

        if (toSend instanceof EmbedBuilder) {
            message.channel.send({ embeds: [toSend] });
        } else {
            Util.send(message, 'none', toSend, false);
        }
    }
}

module.exports = command;