import Discord from 'discord.js';
import GuildSettings from '../core/guildSettings';
import { Command, PickupSettings } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'subfor',
    aliases: ['sf'],
    category: 'pickup',
    shortDesc: 'Request to sub a player for pickups with teams, call without player to remove your previous request',
    desc: 'Request to sub a player for pickups with teams, call without player to remove your previous request',
    args: [
        { name: '<player>', desc: 'ping', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), false);

        if (!latestUnratedPickup) {
            return message.reply('no rateable pickup found');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return message.reply(`the pickup is too old, you can only send sub requests for pickups less than ${Util.formatTime(guildSettings.reportExpireTime)} old`);
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), latestUnratedPickup.pickupConfigId);

        // Disallow banned players to sub
        // Role check
        const allowedToAdd = roleCheck(pickupSettings, guildSettings, message, pickupSettings.id);

        if (!allowedToAdd) {
            return message.reply('you are not allowed to send sub requests for this pickup');
        }

        // Trust check
        if (guildSettings.explicitTrust) {
            const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(message.guild.id), message.member.id);

            if (!alreadyTrusted.length) {
                const playedBefore = await PickupModel.playedBefore(BigInt(message.guild.id), BigInt(message.author.id));

                if (!playedBefore) {
                    return message.reply('no previous pickup game found for you, you need to be trusted to add');
                }
            }
        }

        if (guildSettings.trustTime) {
            const trustTime = guildSettings.trustTime;
            const joinDate = message.member.joinedAt;
            const timeLeft = (joinDate.getTime() + trustTime) - new Date().getTime();
            if (timeLeft > 0) {
                // Check if already trusted
                const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(message.guild.id), message.member.id);

                if (alreadyTrusted.length === 0) {
                    return message.reply(`you joined this server recently, please wait ${Util.formatTime(Math.abs(timeLeft))}`);
                }
            }
        }

        // Ban check
        const isBanned = await PlayerModel.isPlayerBanned(BigInt(message.guild.id), BigInt(message.member.id));

        if (isBanned) {
            return message.reply('banned players are not allowed to send sub requests');
        }

        const alreadySendRequest = await PlayerModel.getSubRequest(BigInt(message.guild.id), BigInt(message.author.id));

        if (!params.length) {
            if (alreadySendRequest) {
                await PlayerModel.clearSubRequest(BigInt(message.guild.id), BigInt(message.author.id));
                return message.reply('cancelled sub request');
            } else {
                return message.reply('no sub request to cancel available');
            }
        }

        const playersInPickup = latestUnratedPickup.teams
            .map(team => team.players)
            .flat()
            .map(player => player.id);

        // Make sure the requester isn't a player of this pickup
        if (playersInPickup.includes(message.author.id)) {
            return message.reply(`you can't send a sub request as participant in the same pickup`);
        }

        // Make sure the given player is valid and added to the pickup
        const player = await Util.getUser(message.guild, params[0]) as Discord.GuildMember;

        if (!player) {
            return message.reply(`given player for sub request not found`);
        }

        // Added to the pickup
        if (!playersInPickup.includes(player.id)) {
            return message.reply('given player is not added to the latest unrated pickup');
        }

        // Make sure the given player isn't already requested
        if (alreadySendRequest) {
            if (player.id === alreadySendRequest) {
                return message.reply('you already sent a sub request for the given player');
            }
        }

        await PlayerModel.setSubRequest(BigInt(message.guild.id), BigInt(message.author.id), BigInt(player.id));
        message.channel.send(`requested to sub ${player.displayName}, <@${player.id}> use ${guildSettings.prefix}acceptsub <@${message.author.id}> to accept subbing or ignore the request`);
    }
}

const roleCheck = (pickupSettings: PickupSettings, guildSettings: GuildSettings, message: Discord.Message, pickupId): boolean => {
    const userRoles = message.member.roles.cache;

    if (pickupSettings.whitelistRole) {
        if (!userRoles.has(pickupSettings.whitelistRole.toString())) {
            return false;
        }
    } else if (pickupSettings.blacklistRole) {
        if (userRoles.has(pickupSettings.blacklistRole.toString())) {
            return false;
        }
    }

    // Guild defaults
    if (guildSettings.whitelistRole) {
        if (!userRoles.has(guildSettings.whitelistRole.toString())) {
            return false;
        }
    } else if (guildSettings.blacklistRole) {
        if (userRoles.has(guildSettings.blacklistRole.toString())) {
            return false;
        }
    }

    return true;
}

module.exports = command;