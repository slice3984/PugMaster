import Discord, { MessageEmbed } from 'discord.js';
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

        let toSend;

        if (pickups.length > 15) {
            toSend = `Available pickups\n` +
                pickups.map(pickup => `**${pickup.name}${pickup.rated ? ' (Rated)' : ''}** [ **${pickup.added}** / **${pickup.max}** ]`).join(' ');
        } else {
            toSend = new Discord.MessageEmbed()
                .setColor('#126e82')
                .setTitle('Available pickups')
                .addFields(
                    { name: 'Pickup', value: pickups.map(pickup => pickup.name).join('\n'), inline: true },
                    { name: 'Players', value: pickups.map(pickup => `${pickup.added} / ${pickup.max}`).join('\n'), inline: true },
                    { name: 'Rated', value: pickups.map(pickup => `${pickup.rated ? 'Yes' : 'No'}`).join('\n'), inline: true }
                );
        }

        if (toSend instanceof MessageEmbed) {
            message.channel.send({ embeds: [toSend] });
        } else {
            message.channel.send(toSend);
        }
    }
}

module.exports = command;