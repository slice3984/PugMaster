import PickupStage from '../core/PickupStage';
import { Command, RateablePickup } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'unrate',
    category: 'admin',
    shortDesc: 'Unrates the latest rateable pickup, call with show to see which pickup will be unrated',
    desc: 'Unrates the latest rateable pickup, call with show to see which pickup will be unrated',
    args: [
        { name: '[show]', desc: 'call with show to display the pickup which will be unrated', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const latestRatedPickup = await PickupModel.getLatestRatedPickup(BigInt(message.guild.id));

        if (!latestRatedPickup) {
            return message.reply('no rated pickup found');
        }

        if (params.length) {
            if (params[0].toLowerCase() === 'show') {
                return message.reply(`Pickup **#${latestRatedPickup.pickupId}** - ${latestRatedPickup.name} will be unrated`);
            } else {
                return message.reply('invalid argument given, did you mean show?');
            }
        }

        await PickupStage.unrateMatch(message.guild.id, latestRatedPickup);

        message.channel.send(`Unrated pickup #**${latestRatedPickup.pickupId}** - **${latestRatedPickup.name}**, player ratings restored`);
    }
}

module.exports = command;