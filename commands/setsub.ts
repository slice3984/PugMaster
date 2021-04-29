import Discord from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'setsub',
    aliases: ['ss'],
    category: 'admin',
    shortDesc: 'Replace a player with a substitute for the last rateable pickup',
    desc: 'Replace a player with a substitute for the last rateable pickup',
    args: [
        { name: '<particpant>', desc: 'player to replace given as mention or id', required: true },
        { name: '<substitute>', desc: 'substitute player for the given player as mention or id', required: true }
    ],
    global: false,
    perms: true,
    exec: async (bot, message, params, defaults) => {
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id));

        if (!latestUnratedPickup || latestUnratedPickup.isRated) {
            return message.reply('no rateable pickup found');
        }

        const playersInPickup = latestUnratedPickup.teams
            .map(team => team.players)
            .flat()
            .map(player => player.id);

        // Added player
        const addedPlayer = await Util.getUser(message.guild, params[0]) as Discord.GuildMember;

        if (!addedPlayer) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given player to replace not found`));
        }

        if (!playersInPickup.includes(addedPlayer.id)) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given player to replace didn't participate in the latest rateable pickup`));
        }

        // Sub
        const subPlayer = await Util.getUser(message.guild, params[1]) as Discord.GuildMember;

        if (!subPlayer) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given substitute player not found`));
        }

        if (playersInPickup.includes(subPlayer.id)) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given substitute player participated in the latest rateable pickup as well, not available as substitute`));
        }

        await StatsModel.replacePlayer(BigInt(message.guild.id), latestUnratedPickup.pickupId, BigInt(addedPlayer.id), BigInt(subPlayer.id));
        message.channel.send(Util.formatMessage('success', `Set **${subPlayer.displayName}** as substitute for **${addedPlayer.displayName}** for pickup **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`));
    }
}

module.exports = command;