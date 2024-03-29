import Discord from 'discord.js';
import { Command, ChannelType } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';

const command: Command = {
    cmd: 'pickup',
    category: 'admin',
    shortDesc: 'Setup channel for pickups',
    desc: 'Sets the channel to the type given as argument',
    args: [
        { name: '<channelType>', desc: 'Channel type, can be pickup or listen, none to disable', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const types = ['pickup', 'listen', 'none'];
        const channelType = params[0].toLowerCase();

        if (!(types.includes(channelType))) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, invalid channel type, valid types are: ${types.map(type => `**${type}**`).join(', ')}`));
        }

        const guildId = BigInt(message.guild.id);
        const channelId = BigInt(message.channel.id);
        const currChannelType = await GuildModel.getChannelType(guildId, channelId);
        // No bot channel set for this guild channel
        if (!currChannelType) {
            await GuildModel.createChannel(guildId, channelId, channelType);
            Util.send(message, 'success', `Configured channel **${(message.channel as Discord.TextChannel).name}** as **${channelType}** channel`, false);
        } else {
            if (channelType === 'none') {
                await GuildModel.removeChannel(guildId, channelId);
                return Util.send(message, 'success', `Deleted ${currChannelType} channel`, false);
            }
            if (currChannelType === channelType) {
                return Util.send(message, 'error', `This channel is already a **${currChannelType}** channel`, false);
            }

            await GuildModel.updateChannel(guildId, channelId, channelType);
            return Util.send(message, 'success', `Channel updated, channel type is **${channelType}** instead of **${currChannelType}** now`, false);
        }
    }
}

module.exports = command;