import Discord from 'discord.js';
import Bot from '../bot';
import Guild from './../../models/guild';

module.exports = async (bot: Bot, guild: Discord.Guild) => {
    const isBanned = await Guild.isGuildBanned(BigInt(guild.id));
    if (isBanned) {
        return await bot.getClient().guilds.cache.get(guild.id).leave();
    }

    const stored = await Guild.isGuildStored(BigInt(guild.id));
    if (stored) {
        console.log(`Joined already stored guild '${guild.name}'`);
        // TODO: Clear state
    } else {
        const newGuild = await Guild.createGuild(guild);
        console.log(`Successfully stored new guild '${newGuild}'`);
        // TODO: Clear state
    }
}