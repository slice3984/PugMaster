import { Command } from '../core/types';
import GuildModel from '../models/guild';
import Util from '../core/util';

const command: Command = {
    cmd: 'warns',
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

        const warns = await GuildModel.getWarns(BigInt(message.guild.id), 11);

        if (!warns.length) {
            return message.reply('no warns found');
        }

        const formattedWarns = ['Warned players (Limit 10)'];

        if (warns.length === 11) {
            formattedWarns.push(`...earlier warns`);
        }

        warns.forEach((warn, index) => {
            if (index === 10) {
                return;
            }

            const timeDif = (warn.warned_at.getTime() + guildSettings.warnExpiration) - new Date().getTime();
            const issuer = defaults[0] === 'true' ? ' Issuer: ' + warn.issuer : '';

            let reason = warn.reason;

            if (reason && reason.length > 45) {
                reason = reason.substr(0, 45) + '...';
            }

            const warnCount = `${warn.warns}/${guildSettings.warnsUntilBan} warns`;

            formattedWarns.push(`Warnid: ${warn.warnid} Player: ${warn.player}${issuer} Time left: ${Util.formatTime(timeDif)}${reason ? ' Reason: ' + reason : ''} - ${warnCount}`);
        });

        message.channel.send(formattedWarns.join('\n'));
    }
}

module.exports = command;