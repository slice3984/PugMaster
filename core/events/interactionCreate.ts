import Discord, { Interaction } from 'discord.js';
import Bot from '../bot';
import CommandHandler from '../commandHandler';

const commandHandler = CommandHandler.getInstance();

module.exports = async (bot: Bot, i: Interaction) => {
    if (!i.isCommand() || !i.channel || i.channel.type !== 'GUILD_TEXT') {
        return;
    }

    const args = i.options?.data?.map(o => o.value);
    commandHandler.execute(i, i.commandName, args);
}