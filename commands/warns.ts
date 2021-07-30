import Discord from 'discord.js';
import { Command } from '../core/types';
import GuildModel from '../models/guild';
import Util from '../core/util';

const command: Command = {
    cmd: 'warns',
    category: 'info',
    shortDesc: 'List warned players',
    desc: 'List warned players',
    defaults: [
        {
            type: 'string', name: 'show_issuer', desc: 'Display issuers as well in warns',
            value: 'true', possibleValues: ['true', 'false']
        }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);
        const displayIssuers = defaults[0] === 'true';

        const warnedPlayers = [];
        const issuers = [];
        const times = [];
        const reasons = [];

        const warns = await GuildModel.getWarns(BigInt(message.guild.id), 11);

        if (!warns.length) {
            return message.channel.send(Util.formatMessage('info', `${message.author}, no warns found`));
        }

        warns.forEach((warn, index) => {
            if (index === 10) {
                return;
            }

            const timeDif = (warn.warned_at.getTime() + guildSettings.warnExpiration) - new Date().getTime();
            const issuer = warn.issuer;

            let reason = warn.reason;

            if (reason && reason.length > 45) {
                reason = reason.substr(0, 45) + '...';
            }

            warnedPlayers.push(`${warn.warnid} - ${warn.player}${displayIssuers ? '\n' : ''}`);
            times.push(`${Util.formatTime(timeDif)}${displayIssuers ? '\n' : ''}`);
            issuers.push(issuer);
            reasons.push(reason ? reason : '-');
        });

        let fieldData: Discord.EmbedFieldData[];

        if (displayIssuers) {
            const issuerReasonColumn = issuers.map((issuer, idx) => `${issuer}\n${reasons[idx]}`);

            fieldData = [
                { name: 'Warn id / Player', value: warnedPlayers.join('\n'), inline: true },
                { name: 'Time left', value: times.join('\n'), inline: true },
                { name: 'Issuer / Reason', value: issuerReasonColumn.join('\n'), inline: true }
            ]
        } else {
            fieldData = [
                { name: 'Warn id / Player', value: warnedPlayers.join('\n'), inline: true },
                { name: 'Time left', value: times.join('\n'), inline: true },
                { name: 'Reason', value: reasons.join('\n'), inline: true }
            ]
        }

        const botAvatarUrl = message.guild.client.user.avatarURL();

        const warnsCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle('Warned players')
            .addFields(fieldData)
            .setFooter(`Limited to 10 warns${warns.length > 10 ? ', one or more active warns not displayed' : ''}`, botAvatarUrl);

        message.channel.send({ embeds: [warnsCardEmbed] });
    }
}

module.exports = command;