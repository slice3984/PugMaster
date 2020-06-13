import { Command } from '../core/types';

const command: Command = {
    cmd: 'help',
    aliases: ['h'],
    shortDesc: 'Shows how to use a given command',
    desc: 'Shows usage, aliases and explains how to use a command',
    args: [
        { name: '<cmd>', desc: 'Command name', required: true }
    ],
    global: true,
    perms: false,
    exec: (bot, message, params) => {
        if (!bot.doesCommandExist(params[0].toLowerCase())) {
            return message.reply('command not found');
        }

        const cmd = bot.getCommand(params[0].toLowerCase());
        const prefix = bot.getGuild(message.guild.id).prefix;

        let helpReply = `Help - ${prefix}${cmd.cmd}\n`;
        helpReply += `${cmd.desc}\n`;

        if (cmd.aliases) {
            helpReply += `Aliases: ${cmd.aliases.join(' ')}\n`;
        }

        helpReply += `Usage: ${prefix}${cmd.cmd} `;

        if (cmd.args) {
            cmd.args.forEach(arg => helpReply += `${arg.name} `);
            helpReply += `\n`;

            cmd.args.forEach(arg => {
                helpReply += `${arg.name} - `;

                switch (arg.desc) {
                    case 'ping':
                        helpReply += 'User supplied as ping or user id';
                        break;
                    case 'time':
                        helpReply += 'Time given as 1m 2h 3d 4w - minutes, hours, days, weeks';
                        break;
                    case 'time-short':
                        helpReply += 'Time given as 1m 2h 3d - minutes, hours, days';
                        break;
                    default:
                        helpReply += arg.desc;
                }
                helpReply += '\n';
            });
        }
        message.channel.send(helpReply);
    }
}

module.exports = command;