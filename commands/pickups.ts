import Discord from 'discord.js';
import { Command } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'pickups',
    category: 'info',
    shortDesc: 'Shows available pickups',
    desc: 'Shows available pickups',
    global: true,
    perms: false,
    exec: async (bot, message, params) => {
        const pickups = await PickupModel.getAllPickups(BigInt(message.guild.id));

        if (!pickups.length) {
            return message.reply('no pickups stored');
        }

        const pickupCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle('Available pickups')
            .addFields(
                { name: 'Pickup', value: pickups.map(pickup => pickup.name).join('\n'), inline: true },
                { name: 'Players', value: pickups.map(pickup => `${pickup.added} / ${pickup.max}`).join('\n'), inline: true }
            )

        message.channel.send(pickupCardEmbed);
    }
}

module.exports = command;