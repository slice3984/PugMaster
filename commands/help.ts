import Discord from 'discord.js';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';

const command: Command = {
    cmd: 'help',
    category: 'info',
    aliases: ['h'],
    shortDesc: 'Shows how to use a given command',
    desc: 'Shows usage, aliases and explains how to use a command',
    args: [
        { name: '<cmd>', desc: 'Command name', required: true }
    ],
    global: true,
    perms: false,
    exec: (bot, message, params) => {
        const config = ConfigTool.getConfig();

        if (!bot.doesCommandExist(params[0].toLowerCase())) {
            return message.reply('command not found');
        }

        const cmd = bot.getCommand(params[0].toLowerCase());
        const prefix = bot.getGuild(message.guild.id).prefix;

        const fieldData: Discord.EmbedFieldData[] = [];

        fieldData.push({ name: 'Command', value: cmd.cmd, inline: true });

        if (cmd.aliases) {
            fieldData.push({ name: 'Aliases', value: cmd.aliases.join(', '), inline: true });
        }

        fieldData.push({ name: 'Category', value: cmd.category, inline: true });



        fieldData.push({ name: 'Usage', value: `${prefix}${cmd.cmd} ${cmd.args ? cmd.args.map(arg => arg.name).join(' ') : ''}` })

        if (cmd.args) {
            const argDescs = cmd.args.map(arg => {
                switch (arg.desc) {
                    case 'ping': return 'User supplied as ping or user id';
                    case 'time': return 'Time given as 1m 2h 3d 4w - minutes, hours, days, weeks';
                    case 'time-short': return 'Time given as 1m 2h 3d - minutes, hours, days';
                    default: return arg.desc;
                }
            });

            fieldData.push({ name: 'Argument', value: cmd.args.map(arg => arg.name).join('\n'), inline: true });
            fieldData.push({ name: 'Description', value: argDescs.join('\n'), inline: true });
        }

        const botAvatarUrl = message.guild.client.user.avatarURL();

        const helpCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`Help - **${prefix}${cmd.cmd}**`)
            .setDescription(cmd.desc)
            .addFields(fieldData)
            .setFooter(`${config.webserver.domain}/commands/${cmd.cmd}`, botAvatarUrl)

        message.channel.send(helpCardEmbed);
    }
}

module.exports = command;