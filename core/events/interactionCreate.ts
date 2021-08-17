import { Interaction } from 'discord.js';
import Bot from '../bot';
import CommandHandler from '../commandHandler';
import { GuildMemberExtended } from '../types';

const commandHandler = CommandHandler.getInstance();

module.exports = async (bot: Bot, i: Interaction) => {
    if (!i.isCommand() || !i.channel || i.channel.type !== 'GUILD_TEXT') {
        return;
    }

    // Store for afk check, also interactions update activity
    (i.member as GuildMemberExtended).lastMessageTimestamp = i.createdTimestamp;

    const args = i.options?.data?.map(o => o.value);
    commandHandler.execute(i, i.commandName, args);
}