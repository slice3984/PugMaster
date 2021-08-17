import Discord, { GuildMember } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'acceptsub',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'player',
                    description: 'Player who requested you to sub',
                    type: 'USER',
                    required: true
                }
            ]
        }
    },
    aliases: ['as'],
    category: 'pickup',
    shortDesc: 'Accept incoming sub requests',
    desc: 'Accept incoming sub requests',
    args: [
        { name: '<player>', desc: 'ping', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        const guildSettings = bot.getGuild(guild.id);

        // Make sure the player is able to getting subbed
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(guild.id));

        if (!latestUnratedPickup) {
            return await Util.send(message ? message : interaction, 'error', 'no pickup found you can be subbed for');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;


        if (Date.now() > endTimestamp) {
            return await Util.send(message ? message : interaction, 'error', `your latest rateable pickup is too old, you can only accept sub requests for pickups less than ${Util.formatTime(guildSettings.reportExpireTime)} old`);
        }

        // Check if the player is added to the latest pickup
        const playersInPickup = latestUnratedPickup.teams
            .map(team => team.players)
            .flat()
            .map(player => player.id);

        if (!playersInPickup.includes(member.id)) {
            return await Util.send(message ? message : interaction, 'error', 'you are not a participant in the latest rateable pickup');
        }

        // Validate the given player
        const player = await Util.getUser(guild, params[0]) as Discord.GuildMember;

        // Exists
        if (!player) {
            return await Util.send(message ? message : interaction, 'error', 'given player to accept sub request not found');
        }

        // Sent a sub request
        const sentRequest = await PlayerModel.getSubRequest(BigInt(guild.id), BigInt(player.id));

        if (!sentRequest) {
            return await Util.send(message ? message : interaction, 'error', `${player.displayName} didn't send any sub request`);
        }

        // Sub request for the caller
        if (sentRequest !== member.id) {
            return await Util.send(message ? message : interaction, 'error', `${player.displayName} didn't send a sub request for you`);
        }

        // Clear all sub requests for this player
        await GuildModel.clearSubRequestsForPlayer(BigInt(guild.id), BigInt(member.id));

        // Replace player in stored pickups
        await StatsModel.replacePlayer(BigInt(guild.id), latestUnratedPickup.pickupId, BigInt(member.id), BigInt(player.id));

        await Util.send(message ? message : interaction, 'success', `Accepted sub request from ${player.displayName}, stored <@${player.id}> as substitute of <@${member.id}>`);
    }
}

module.exports = command;