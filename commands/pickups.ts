import { Command } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'pickups',
    shortDesc: 'Shows available pickups',
    desc: 'Shows available pickups',
    global: true,
    perms: false,
    exec: async (bot, message, params) => {
        const pickups = await PickupModel.getAllPickups(BigInt(message.guild.id));

        if (!pickups.length) {
            return message.reply('no pickups stored');
        }

        message.channel.send(`Pickups: ${pickups.map(pickup => `**${pickup.name}** [ **${pickup.added}** / **${pickup.max}** ]`).join(' ')}`);
    }
}

module.exports = command;