import Discord, { GuildMember } from 'discord.js';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import PermissionModel from '../models/permission';

const command: Command = {
    cmd: 'commands',
    applicationCommand: {
        global: true
    },
    category: 'info',
    aliases: ['cmds'],
    shortDesc: 'Shows all available commands to you (Excludes commands with missing permissions)',
    desc: 'Shows all available commands to you (Excludes commands with missing permissions)',
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const config = ConfigTool.getConfig();

        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        // All permissions granted as admin
        const isAdmin = member.permissions.has([Discord.Permissions.FLAGS.ADMINISTRATOR]);
        const disabledCommands = bot.getGuild(guild.id).disabledCommands;
        const allCommands = bot.getCommandNames();
        const availableCommands = allCommands.filter(command =>
            !disabledCommands.includes(command) && command !== 'test');

        const grantedCommands = [];
        let availablePermissions = [];

        // Only check role permissions if the user got no admin permissions
        if (!isAdmin) {
            availablePermissions = await PermissionModel.getRoleCommandPermissions(BigInt(guild.id), ...member.roles.cache.map(role => BigInt(role.id)));
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

        const botAvatarUrl = guild.client.user.avatarURL();

        const commandsCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`${member.displayName} - Commands you can execute`)
            .setDescription(`Command reference: ${config.webserver.domain}/commands`)
            .addField('\u200B', grantedCommands.join(', '))
            .setFooter('*Commands which require permissions', botAvatarUrl)

        if (interaction) {
            interaction.reply({ embeds: [commandsCardEmbed] });
        } else {
            message.channel.send({ embeds: [commandsCardEmbed] });
        }
    }
}

module.exports = command;