import Discord from 'discord.js';
import Bot from '../bot';
import CommandHandler from '../commandHandler';
import PickupModel from '../../models/pickup';

const commandHandler = new CommandHandler(Bot.getInstance());

module.exports = (bot: Bot, message: Discord.Message) => {
    if (message.member.user.bot) {
        return;
    }

    const guildPrefix = bot.getGuild(message.guild.id).prefix;

    if (!message.content.startsWith(guildPrefix)) {
        return;
    }

    const parts = message.content.split(' ');
    const cmd = parts.shift().substr(guildPrefix.length);
    const args = parts;

    commandHandler.execute(message, cmd.toLocaleLowerCase(), args);
}