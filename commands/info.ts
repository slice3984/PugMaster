import { EmbedBuilder } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'info',
    applicationCommand: {
        global: true
    },
    category: 'info',
    shortDesc: 'Shows bot information like uptime, connected servers and more',
    desc: 'Shows bot information like uptime, connected servers and more',
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const client = bot.getClient();

        const uptimeInMs = bot.getClient().uptime;
        const uptimeStr = uptimeInMs > 60000 ? Util.formatTime(uptimeInMs, true) : '<1m';
        const connectedGuilds = client.guilds.cache.size;
        const totalCommands = bot.getCommands().length;
        const totalPickups = await StatsModel.getTotalPickupsCount();
        const uniquePickupPlayers = await StatsModel.getTotalKnownPlayers();

        const infoEmbed = new EmbedBuilder()
            .setColor('#126e82')
            .setAuthor({ name: 'Bot information', iconURL: client.user.avatarURL()})
            .addFields(
                { name: 'Uptime', value: uptimeStr, inline: true },
                { name: 'Active servers', value: connectedGuilds.toString(), inline: true },
                { name: 'Total commands', value: totalCommands.toString(), inline: true },
                { name: 'Total pickups', value: totalPickups.toString(), inline: true },
                { name: 'Total players', value: uniquePickupPlayers.toString(), inline: true },
                { name: 'Source', value: '[GitHub](https://github.com/slice3984/PugMaster)', inline: true }
            )
        if (interaction) {
            interaction.reply({ embeds: [infoEmbed] });
        } else {
            message.channel.send({ embeds: [infoEmbed] });
        }
    }
}

module.exports = command;