import Discord from 'discord.js';
import Bot from '../bot';
import GuildModel from './../../models/guild';

module.exports = async (bot: Bot, guild: Discord.Guild) => {
    const isBanned = await GuildModel.isGuildBanned(BigInt(guild.id));
    if (isBanned) {
        return await bot.getClient().guilds.cache.get(guild.id).leave();
    }

    const stored = await GuildModel.isGuildStored(BigInt(guild.id));
    if (stored) {
        console.log(`Joined already stored guild '${guild.name}'`);
        // TODO: Clear state
    } else {
        const newGuild = await GuildModel.createGuild(guild);
        console.log(`Successfully stored new guild '${newGuild}'`);
    }

    const settings = await GuildModel.getGuildSettings(guild);
    const guildCommands = bot.getCommands();

    for (const command of guildCommands) {
        if (!command.applicationCommand || command.applicationCommand.global) {
            continue;
        }

        try {
            const applicationCommand = await guild.commands.create({
                name: command.cmd,
                description: command.shortDesc,
                options: await command.applicationCommand.getOptions(guild)
            });

            settings.applicationCommands.set(command.cmd, applicationCommand);
        } catch (_) { }
    }

    bot.addGuild(settings);
}