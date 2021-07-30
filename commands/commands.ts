import Discord from 'discord.js';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import PermissionModel from '../models/permission';

const command: Command = {
    cmd: 'commands',
    category: 'info',
    aliases: ['cmds'],
    shortDesc: 'Shows all available commands to you (Excludes commands with missing permissions)',
    desc: 'Shows all available commands to you (Excludes commands with missing permissions)',
    global: true,
    perms: false,
    exec: async (bot, message, params) => {
        const config = ConfigTool.getConfig();

        // All permissions granted as admin
        const isAdmin = message.member.permissions.has([Discord.Permissions.FLAGS.ADMINISTRATOR]);
        const disabledCommands = bot.getGuild(message.guild.id).disabledCommands;
        const allCommands = bot.getCommandNames();
        const availableCommands = allCommands.filter(command => !disabledCommands.includes(command));

        const grantedCommands = [];
        let availablePermissions = [];

        // Only check role permissions if the user got no admin permissions
        if (!isAdmin) {
            availablePermissions = await PermissionModel.getRoleCommandPermissions(BigInt(message.guild.id), ...message.member.roles.cache.map(role => BigInt(role.id)));
        }

        for (const command of availableCommands) {
            const needsPermissions = bot.getCommand(command).perms;
            if (needsPermissions) {
                if (isAdmin || availablePermissions.includes(command)) {
                    grantedCommands.push(`**${command}***`);
                }
            } else {
                grantedCommands.push(`**${command}**`);
            }
        }

        const botAvatarUrl = message.guild.client.user.avatarURL();

        const commandsCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`${message.member.displayName} - Commands you can execute`)
            .setDescription(`Command reference: ${config.webserver.domain}/commands`)
            .addField('\u200B', grantedCommands.join(', '))
            .setFooter('*Commands which require permissions', botAvatarUrl)

        message.channel.send({ embeds: [commandsCardEmbed] });
    }
}

module.exports = command;