import Discord, { ApplicationCommandOptionType } from 'discord.js';
import GuildSettings from '../core/guildSettings';
import { Command, PickupSettings } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'subfor',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'player',
                    description: 'Player to request subbing',
                    type: ApplicationCommandOptionType.User
                }
            ]
        }
    },
    aliases: ['sf'],
    category: 'pickup',
    shortDesc: 'Request to sub a player for pickups with teams, call without player to remove your previous request',
    desc: 'Request to sub a player for pickups with teams, call without player to remove your previous request',
    args: [
        { name: '<player>', desc: 'ping', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as Discord.GuildMember : message.member;

        const guildSettings = bot.getGuild(guild.id);
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(guild.id));

        if (!latestUnratedPickup || latestUnratedPickup.isRated) {
            return Util.send(message ? message : interaction, 'error', 'no rateable pickup found');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return Util.send(message ? message : interaction, 'error', `the pickup is too old, you can only send sub requests for pickups less than **${Util.formatTime(guildSettings.reportExpireTime)}** old`);
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), latestUnratedPickup.pickupConfigId);

        // Disallow banned players to sub
        // Role check
        const allowedToAdd = roleCheck(pickupSettings, guildSettings, member, pickupSettings.id);

        if (!allowedToAdd) {
            return Util.send(message ? message : interaction, 'error', 'you are not allowed to send sub requests for this pickup');
        }

        // Trust check
        if (guildSettings.explicitTrust) {
            const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(guild.id), member.id);

            if (!alreadyTrusted.length) {
                const playedBefore = await PickupModel.playedBefore(BigInt(guild.id), BigInt(member.id));

                if (!playedBefore) {
                    return Util.send(message ? message : interaction, 'error', 'no previous pickup game found for you, you need to be trusted to sub');
                }
            }
        }

        if (guildSettings.trustTime) {
            const trustTime = guildSettings.trustTime;
            const joinDate = member.joinedAt;
            const timeLeft = (joinDate.getTime() + trustTime) - new Date().getTime();
            if (timeLeft > 0) {
                // Check if already trusted
                const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(guild.id), member.id);

                if (alreadyTrusted.length === 0) {
                    return Util.send(message ? message : interaction, 'error', `you joined this server recently, please wait **${Util.formatTime(Math.abs(timeLeft))}**`);
                }
            }
        }

        // Ban check
        const isBanned = await PlayerModel.isPlayerBanned(BigInt(guild.id), BigInt(member.id));

        if (isBanned) {
            return Util.send(message ? message : interaction, 'error', 'banned players are not allowed to send sub requests');
        }

        const alreadySendRequest = await PlayerModel.getSubRequest(BigInt(guild.id), BigInt(member.id));

        if (!params.length) {
            if (alreadySendRequest) {
                await PlayerModel.clearSubRequest(BigInt(guild.id), BigInt(member.id));
                return Util.send(message ? message : interaction, 'success', 'cancelled sub request');
            } else {
                return Util.send(message ? message : interaction, 'error', 'no sub request to cancel available');
            }
        }

        const playersInPickup = latestUnratedPickup.teams
            .map(team => team.players)
            .flat()
            .map(player => player.id);

        // Make sure the requester isn't a player of this pickup
        if (playersInPickup.includes(member.id)) {
            return Util.send(message ? message : interaction, 'error', 'you can\'t send a sub request as participant in the same pickup');
        }

        // Make sure the given player is valid and added to the pickup
        const player = await Util.getUser(guild, params[0]) as Discord.GuildMember;

        if (!player) {
            return Util.send(message ? message : interaction, 'error', 'given player for sub request not found');
        }

        // Added to the pickup
        if (!playersInPickup.includes(player.id)) {
            return Util.send(message ? message : interaction, 'error', 'given player is not added to the latest unrated pickup');
        }

        // Make sure the given player isn't already requested
        if (alreadySendRequest) {
            if (player.id === alreadySendRequest) {
                return Util.send(message ? message : interaction, 'error', 'you already sent a sub request for the given player');
            }
        }

        await PlayerModel.setSubRequest(BigInt(guild.id), BigInt(member.id), BigInt(player.id));
        Util.send(message ? message : interaction, 'warn', `Requested to sub **${player.displayName}**, <@${player.id}> use ${guildSettings.prefix}acceptsub <@${member.id}> to accept subbing or ignore the request`, null);
    }
}

const roleCheck = (pickupSettings: PickupSettings, guildSettings: GuildSettings, member: Discord.GuildMember, pickupId): boolean => {
    const userRoles = member.roles.cache;

    if (pickupSettings.allowlistRole) {
        if (!userRoles.has(pickupSettings.allowlistRole.toString() as Discord.Snowflake)) {
            return false;
        }
    } else if (pickupSettings.denylistRole) {
        if (userRoles.has(pickupSettings.denylistRole.toString() as Discord.Snowflake)) {
            return false;
        }
    }

    // Guild defaults
    if (guildSettings.allowlistRole) {
        if (!userRoles.has(guildSettings.allowlistRole.toString() as Discord.Snowflake)) {
            return false;
        }
    } else if (guildSettings.denylistRole) {
        if (userRoles.has(guildSettings.denylistRole.toString() as Discord.Snowflake)) {
            return false;
        }
    }

    return true;
}

module.exports = command;