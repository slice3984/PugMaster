import Discord from 'discord.js';
import Bot from '../bot';
import Guild from './../../models/guild';

module.exports = async (bot: Bot, guild: Discord.Guild) => {
    // Delete stored guild settings
    bot.removeGuild(guild.id);
}