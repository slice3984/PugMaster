import Discord from 'discord.js';
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
        // All permissions granted as admin
        const isAdmin = message.member.hasPermission(Discord.Permissions.FLAGS.ADMINISTRATOR);
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
                    grantedCommands.push(`${command}*`);
                }
            } else {
                grantedCommands.push(command);
            }
        }

        message.reply(
            `available commands you can execute (\\*commands which require permissions)\n` +
            grantedCommands.map(command => `\`${command}\``).join(', ')
        );
    }
}

module.exports = command;