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

    let args = [];
    const optionData = i.options.data;

    if (optionData.length) {
        optionData.forEach(option => {
            if (option.type === 'SUB_COMMAND_GROUP') {
                option.options.forEach(option => {
                    // Sub command with options
                    if (option.options) {
                        args.push(...option.options.map(o => o.value));
                    } else {
                        if (option.value) {
                            args.push(option.value);
                        }
                    }
                })
            } else {
                if (option.value) {
                    args.push(option.value);
                }
            }
        });
    }

    commandHandler.execute(i, i.commandName, args);
}