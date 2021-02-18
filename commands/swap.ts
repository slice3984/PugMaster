import Discord from 'discord.js';
import Util from '../core/util';
import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'swap',
    category: 'admin',
    shortDesc: 'Swap a player with another player in different teams for the latest rateable pickup',
    desc: 'Swap a player with another player in different teams for the latest rateable pickup',
    args: [
        { name: '<player>', desc: 'player to swap', required: true },
        { name: '<player2>', desc: 'player to swap', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params, defaults) => {
        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id));

        if (!latestUnratedPickup && latestUnratedPickup.isRated) {
            return message.reply('no rateable pickup found');
        }

        const playerOne = await Util.getUser(message.guild, params[0]) as Discord.GuildMember;
        const playerTwo = await Util.getUser(message.guild, params[1]) as Discord.GuildMember;

        if (!playerOne || !playerTwo) {
            return message.reply('given players not found');
        }

        // Make sure they are added to the pickup and in different teams
        const teams: { name: String, playerId: String }[] = [];

        const teamPlayerOne = latestUnratedPickup.teams.find(t => t.players.map(p => p.id).includes(playerOne.id));

        if (!teamPlayerOne) {
            return message.reply(`${playerOne.displayName} didn't participate in the latest rateable pickup`);
        }

        teams.push({ name: teamPlayerOne.name, playerId: playerOne.id });

        const teamPlayerTwo = latestUnratedPickup.teams.find(t => t.players.map(p => p.id).includes(playerTwo.id));

        if (!teamPlayerTwo) {
            return message.reply(`${playerTwo.displayName} didn't participate in the latest rateable pickup`);
        }

        teams.push({ name: teamPlayerTwo.name, playerId: playerTwo.id });

        // They have to be in different teams
        if (teams[0].name === teams[1].name) {
            return message.reply('both players play in the same team, can\'t swap them');
        }

        // Swap players
        await StatsModel.swapPlayers(BigInt(message.guild.id), latestUnratedPickup.pickupId, { team: teams[0].name, id: playerOne.id }, { team: teams[1].name, id: playerTwo.id });
        message.reply(`swapped ${playerOne.displayName} (**Team ${teams[0].name}**) with ${playerTwo.displayName} (**Team ${teams[1].name}**) for pickup **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`);
    }
}

module.exports = command;