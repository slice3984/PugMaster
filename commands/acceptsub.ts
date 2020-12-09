import Discord from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'acceptsub',
    aliases: ['as'],
    category: 'pickup',
    shortDesc: 'Accept incoming sub requests',
    desc: 'Accept incoming sub requests',
    args: [
        { name: '<player>', desc: 'ping', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);

        // Make sure the player is able to getting subbed
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id));

        if (!latestUnratedPickup) {
            return message.reply('no pickup found you can be subbed for');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;


        if (Date.now() > endTimestamp) {
            return message.reply(`latest rateable pickup is too old, you can only accept sub requests for pickups less than ${Util.formatTime(guildSettings.reportExpireTime)} old`);
        }

        // Check if the player is added to the latest pickup
        const playersInPickup = latestUnratedPickup.teams
            .map(team => team.players)
            .flat()
            .map(player => player.id);

        if (!playersInPickup.includes(message.author.id)) {
            return message.reply('you are not a participant in the latest rateable pickup');
        }

        // Validate the given player
        const player = await Util.getUser(message.guild, params[0]) as Discord.GuildMember;

        // Exists
        if (!player) {
            return message.reply('given player to accept sub request not found');
        }

        // Sent a sub request
        const sentRequest = await PlayerModel.getSubRequest(BigInt(message.guild.id), BigInt(player.id));

        if (!sentRequest) {
            return message.reply(`${player.displayName} didn't send any sub request`);
        }

        // Sub request for the caller
        if (sentRequest !== message.author.id) {
            return message.reply(`${player.displayName} didn't send a sub request for you`);
        }

        // Clear all sub requests for this player
        await GuildModel.clearSubRequestsForPlayer(BigInt(message.guild.id), BigInt(message.author.id));

        // Replace player in stored pickups
        await StatsModel.replacePlayer(BigInt(message.guild.id), latestUnratedPickup.pickupId, BigInt(message.author.id), BigInt(player.id));

        message.channel.send(`accepted sub request from ${player.displayName}, stored <@${player.id}> as substitute of <@${message.author.id}>`);
    }
}

module.exports = command;