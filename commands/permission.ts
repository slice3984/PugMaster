import { Command } from '../core/types';
import Util from '../core/util';
import PermissionModel from '../models/permission';

const command: Command = {
    cmd: 'permission',
    category: 'admin',
    aliases: ['perm'],
    shortDesc: 'Sets or shows permissions for a given role',
    desc: 'Shows command permissions or sets/revokes them for a given role',
    args: [
        { name: '<role>', desc: 'Role given as mention, id or name', required: true },
        { name: '<add/remove/show>', desc: 'Specify if the given permissions are added or removed or just displayed', required: true },
        { name: '[command]...', desc: 'Command names', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const role = Util.getRole(message.guild, params[0]);

        if (!role) {
            return Util.send(message, 'error', 'role not found');
        }

        if (!['add', 'remove', 'show'].includes(params[1].toLowerCase())) {
            return Util.send(message, 'error', 'second argument has to be **add**, **remove** or **show**');
        }

        if (params[1].toLowerCase() === 'show') {
            const permissions = await PermissionModel.getRoleCommandPermissions(BigInt(message.guild.id), BigInt(role.id));
            if (permissions.length === 0) {
                return Util.send(message, 'info', `There are no permissions set for role **${role.name}**`, false);
            } else {
                return Util.send(message, 'info', `Permissions for role **${role.name}**: ${permissions.map(perm => `**${perm}**`).join(', ')}`, false);
            }
        }

        const availableGuildCommands = bot.getCommandNames();

        // Add sub commands
        ['create', 'delete', 'edit'].forEach(subCommand => {
            if (subCommand === 'edit') {
                availableGuildCommands.push('bot');
            }

            availableGuildCommands.push(`${subCommand}/mappool`, `${subCommand}/pickup`, `${subCommand}/server`);
        });

        const givenCommands = params.slice(2);
        const validCommands = givenCommands.filter(command => availableGuildCommands.includes(command)
            && (command.includes('/') || bot.getCommand(command).perms));

        if (validCommands.length === 0) {
            return Util.send(message, 'error', 'no valid command names given (Make sure the given commands require permissions)');
        }

        const currPermissions = await PermissionModel.getRoleCommandPermissions(BigInt(message.guild.id), BigInt(role.id));

        if (currPermissions.length === 0) {
            // Check if the role is already set
            if (params[1] === 'add' && !await PermissionModel.isGuildRoleStored(BigInt(message.guild.id), BigInt(role.id))) {
                await PermissionModel.storeGuildRole(BigInt(message.guild.id), BigInt(role.id));
            }
        }

        if (params[1] === 'add') {
            // is the permission already set ?
            const permissionsToAdd = validCommands.filter(command => !currPermissions.includes(command));
            if (permissionsToAdd.length === 0) {
                return Util.send(message, 'error', 'Given commands are already set as role permissions', false);
            }

            await PermissionModel.addGuildRoleCommandPermissions(BigInt(role.id), ...permissionsToAdd);
            return Util.send(message, 'success', `Added ${permissionsToAdd.length} permission${permissionsToAdd.length > 1 ? 's' : ''} (${permissionsToAdd.map(perm => `**${perm}**`).join(', ')}) to role **${role.name}**`);
        } else {
            if (currPermissions.length === 0) {
                return Util.send(message, 'error', `There are already no permissions set for role **${role.name}**`, false);
            }

            const permissionsToRemove = validCommands.filter(command => currPermissions.includes(command));
            if (permissionsToRemove.length === 0) {
                return Util.send(message, 'error', `Given commands are not set for role **${role.name}**`, false);
            }

            await PermissionModel.removeGuildRoleCommandPermission(BigInt(role.id), ...permissionsToRemove);
            return Util.send(message, 'success', `Removed ${permissionsToRemove.length} permission${permissionsToRemove.length > 1 ? 's' : ''} (${permissionsToRemove.map(perm => `**${perm}**`).join(', ')}) of role **${role.name}**`, false);
        }
    }
}

module.exports = command;