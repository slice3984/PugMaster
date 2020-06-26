import Discord from 'discord.js';
import Bot from './bot';
import PermissionModel from '../models/permission';

export default class CommandHandler {
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    private async gotPermission(member: Discord.GuildMember, cmd) {
        // Admin
        if (member.hasPermission(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            return true;
        }

        const userRoleIds = member.roles.cache.keyArray().map(strId => BigInt(strId));

        if (userRoleIds.length > 0) {
            // Check if one of the user roles got the required permission
            return await PermissionModel.guildRolesGotCommandPermission(BigInt(member.guild.id), cmd, ...userRoleIds);
        }

        return false;
    }

    private isCommandAvailable(message: Discord.Message, cmd: string) {
        const guild = this.bot.getGuild(message.guild.id);

        // Check if its a valid command
        const isValid = this.bot.doesCommandExist(cmd);

        if (!isValid) {
            return false;
        }

        cmd = this.bot.getCommand(cmd).cmd;

        // Check if guild disabled
        const isDisabled = guild.disabledCommands.includes(cmd);

        if (isDisabled) {
            return false;
        }

        // Make sure its the correct channel, only allow setup commands everywhere
        if (cmd === 'pickup') {
            return true;
        }
        if (guild.channels.has(BigInt(message.channel.id))) {
            if (this.bot.getCommand(cmd).global) {
                return true;
            } else if (guild.channels.get(BigInt(message.channel.id)) === 'pickup') {
                return true;
            } else {
                return false;
            }
        }

        return false;
    }

    async execute(message: Discord.Message, cmd: string, args: any[] = []) {
        if (!this.isCommandAvailable(message, cmd)) {
            return;
        }

        const guild = this.bot.getGuild(message.guild.id);
        const command = this.bot.getCommand(cmd)

        if (command.perms && !(await this.gotPermission(message.member, this.bot.getCommand(cmd).cmd))) {
            return message.reply('insufficient permissions to execute this command')
        }

        // TODO: Flood protection
        ;
        // Test if required args are given
        const requiredArgs = command.args ? command.args.filter(arg => arg.required).length : 0;
        if (requiredArgs > args.length) {
            let reply = `arguments are missing, usage: ${guild.prefix}${command.cmd} `;
            command.args.forEach(arg => reply += `${arg.name} `);
            return message.reply(reply);
        }

        if (guild.commandSettings.has(cmd)) {
            command.exec(this.bot, message, args, guild.commandSettings.get(cmd));
        } else {
            const defaults = command.defaults ? command.defaults.map(def => def.value) : null;

            if (defaults) {
                command.exec(this.bot, message, args, defaults);
            } else {
                command.exec(this.bot, message, args);
            }
        }
    }
}