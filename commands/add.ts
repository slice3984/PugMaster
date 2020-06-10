import { Command } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'add',
    aliases: ['+'],
    shortDesc: 'Add to one or multiple pickups',
    desc: 'Add to one or multiple pickups',
    args: [
        { name: '[pickup]...', desc: 'Name of the pickup', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        // TODO: Ban check / Trust check

        if (params.length === 0) {
            // TODO: Auto add
        } else {
            const existingPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...params);
            if (existingPickups.length === 0) {
                message.reply(`Pickup${params.length > 1 ? 's' : ''} not found`);
            }


        }
    }
};

module.exports = command;