import Discord, { MessageEmbed } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'pickups',
    applicationCommand: {
        global: true,
    },
    category: 'info',
    shortDesc: 'Shows available pickups',
    desc: 'Shows available pickups',
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const pickups = await PickupModel.getAllPickups(BigInt(guild.id));

        if (!pickups.length) {
            return Util.send(message ? message : interaction, 'info', 'no pickups stored');
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
            if (interaction) {
                interaction.reply({ embeds: [toSend] });
            } else {
                message.channel.send({ embeds: [toSend] });
            }
        } else {
            if (interaction) {
                interaction.reply(toSend);
            } else {
                message.channel.send(toSend);
            }
        }
    }
}

module.exports = command;