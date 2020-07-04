import { Command } from '../core/types';
import GuildModel from '../models/guild';
import Util from '../core/util';

const command: Command = {
    cmd: 'bans',
    shortDesc: 'List banned players',
    desc: 'List banned players',
    args: [
        { name: '[perm]', desc: 'Pass perm as argument to display all permbans', required: false }
    ],
    defaults: [
        {
            type: 'string', name: 'show_issuer', desc: 'Display issuers as well in bans',
            value: 'true', possibleValues: ['true', 'false']
        }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params, defaults) => {
        if (params.length === 0) {
            const bans = await GuildModel.getBans(BigInt(message.guild.id), 'timed', 11);

            if (bans.length === 0) {
                return message.reply('no bans found');
            }

            const formattedBans = ['Banned players (Limit 10)'];

            if (bans.length === 11) {
                formattedBans.push(`...earlier bans`);
            }

            bans.forEach((ban, index) => {
                if (index === 10) {
                    return;
                }
                const timeDif = ban.ends_at.getTime() - new Date().getTime();
                const issuer = defaults[0] === 'true' ? ' Issuer: ' + ban.issuer : '';

                let reason = ban.reason;

                if (reason && reason.length > 45) {
                    reason = reason.substr(0, 45) + '...';
                }

                formattedBans.push(`Banid: ${ban.banid} Player: ${ban.player}${issuer} Time left: ${Util.formatTime(timeDif)}${reason ? ' Reason: ' + reason : ''}${ban.is_warn_ban ? ' (AUTOBAN - WARNS)' : ''}`);
            });

            message.channel.send(formattedBans.join('\n'));
        } else {
            if (params[0].toLowerCase() !== 'perm') {
                return message.reply('did you mean perm?');
            }

            const bans = await GuildModel.getBans(BigInt(message.guild.id), 'perms_only', 11);

            if (bans.length === 0) {
                return message.reply('no permbans found');
            }

            const formattedBans = ['Permbanned players (Limit 10)'];

            if (bans.length === 11) {
                formattedBans.push(`...earlier permbans`);
            }

            bans.forEach((ban, index) => {
                if (index === 10) {
                    return;
                }

                let reason = ban.reason;

                if (reason && reason.length > 45) {
                    reason = reason.substr(0, 45) + '...';
                }

                const issuer = defaults[0] === 'true' ? ' Issuer: ' + ban.issuer : '';
                formattedBans.push(`Banid: ${ban.banid} Player: ${ban.player}${issuer}${reason ? ' Reason: ' + reason : ''}`);
            });

            message.channel.send(formattedBans.join('\n'));
        }
    }
}

module.exports = command;