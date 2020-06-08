import { Command, ChannelType } from '../core/types';
import GuildModel from '../models/guild';

const command: Command = {
    cmd: 'pickup',
    shortDesc: 'Setup channel for pickups',
    desc: 'Sets the channel to the type given as argument',
    args: [
        ['<channelType>', 'Channel type, can be pickup, pickup-info or listen, none to disable']
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const types = ['pickup', 'pickup-info', 'listen', 'none'];
        const channelType = params[0].toLowerCase();

        if (!(types.includes(channelType))) {
            return message.reply(`invalid channel type, valid types are: ${types.join(' ')}`);
        }

        const guildId = BigInt(message.guild.id);
        const channelId = BigInt(message.channel.id);
        const currChannelType = await GuildModel.getChannelType(guildId, channelId);
        // No bot channel set for this guild channel
        if (!currChannelType) {
            await GuildModel.createChannel(guildId, channelId, channelType);
            message.reply(`Channel successfully configured as ${channelType} channel`);
        } else {
            if (channelType === 'none') {
                await GuildModel.removeChannel(guildId, channelId);
                return message.reply(`Deleted ${currChannelType} channel`);
            }
            if (currChannelType === channelType) {
                return message.reply(`This channel is already a ${currChannelType} channel`);
            }

            await GuildModel.updateChannel(guildId, channelId, channelType);
            return message.reply(`Channel successfully updated, channel type is ${channelType} instead of ${currChannelType} now`);
        }
    }
}

module.exports = command;