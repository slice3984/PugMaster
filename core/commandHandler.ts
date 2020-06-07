import Discord from 'discord.js';
import { ChannelType } from './types';
import Bot from './bot';

export default class CommandHandler {
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    private gotPermission(member: Discord.GuildMember, cmd): boolean {
        // Admin
        if (member.hasPermission(Discord.Permissions.FLAGS.ADMINISTRATOR)) {
            return true;
        }

        // TODO: Role permissions

        return false;
    }

    private isCommandAvailable(message: Discord.Message, cmd: string) {
        const guild = this.bot.getGuild(message.guild.id);

        // Check if its a valid command
        const isValid = this.bot.doesCommandExist(cmd);

        // Check if guild disabled
        const isDisabled = guild.disabledCommands.includes(cmd);

        if (isDisabled) {
            return false;
        }

        if (isValid) {
            // Make sure its the correct channel, only allow setup commands everywhere
            if (cmd === 'pickup') {
                return true;
            }
            if (guild.channels.has(BigInt(message.channel.id))) {
                if (this.bot.getCommand(cmd).global) {
                    return true;
                } else if (guild.channels.get(BigInt(message.channel.id)) !== 'listen') {
                    return true;
                } else {
                    return false;
                }
            }
        }

        return false;
    }

    execute(message: Discord.Message, cmd: string, args: any[] = []) {
        if (!this.isCommandAvailable(message, cmd)) {
            return;
        }

        const guild = this.bot.getGuild(message.guild.id);
        const command = this.bot.getCommand(cmd)

        if (command.perms && !this.gotPermission(message.member, cmd)) {
            return message.reply('insufficient permissions to execute this command')
        }

        // TODO: Flood protection
        ;
        // Test if required args are given
        if (command.args && args.length == 0) {
            let reply = `arguments are missing, usage: ${guild.prefix}${command.cmd} `;
            command.args.forEach(arg => reply += `${arg[0]} `);
            return message.reply(reply);
        }

        if (guild.commandSettings.has(cmd)) {
            command.exec(this.bot, message, args, guild.commandSettings.get(cmd));
        } else {
            const defaults = command.defaults;

            if (defaults) {
                command.exec(this.bot, message, args, defaults);
            } else {
                command.exec(this.bot, message, args);
            }
        }
    }
}