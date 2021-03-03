import { Command, PickupInfo } from '../core/types';
import PickupModel from '../models/pickup';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'teams',
    category: 'info',
    shortDesc: 'Generates teams based on available ratings for a given played pickup',
    desc: 'Generates teams based on available ratings for a given played pickup',
    args: [
        { name: '[pickupId]', desc: 'Pickup to use, no argument for the latest', required: false }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        let pickup: PickupInfo;

        if (params[0]) {
            if (!/^\d+$/.test(params[0])) {
                return message.reply('pickup id has to be a number');
            }

            pickup = await StatsModel.getPickup(BigInt(message.guild.id), +params[0]);

            if (!pickup) {
                return message.reply('no pickup found for the provided id');
            }
        } else {
            pickup = await StatsModel.getPickup(BigInt(message.guild.id));

            if (!pickup) {
                return message.reply('no pickup found for this server');
            }
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickup.name);

        if (pickupSettings.playerCount === 2) {
            return message.reply(`pickup has to be a pickup with more than two players`);
        }

        const players = pickup.teams
            .map(t => t.players)
            .flat();

        const generatedTeams = [];

        // Use the same team generation used for rating generated teams
        // TODO: Find some better factor for sigma
        const playerRatings = players.map(player => {
            return { ...player, skill: player.rating.mu - 2 * player.rating.sigma }
        })
            .sort((a, b) => b.skill - a.skill);

        while (playerRatings.length > 0) {
            for (let team = 0; team < pickupSettings.teamCount; team++) {
                if (!generatedTeams[team]) {
                    generatedTeams.push([]);
                }

                generatedTeams[team].push(playerRatings.shift());

                if (playerRatings.length >= pickupSettings.teamCount) {
                    generatedTeams[team].push(playerRatings.pop());
                }
            }
        }

        // Output formatting
        const formattedTeams = [];
        generatedTeams.forEach((team, idx) => {
            const teamName = String.fromCharCode(65 + idx); // A, B...
            formattedTeams.push(`**Team ${teamName}**: ${team.map(p => `\`${p.nick}\``).join(', ')}`);
        });

        const prevFormattedTeams = [];
        if (pickup.teams.length === 1) {
            prevFormattedTeams.push(`**Players: **${pickup.teams[0].players.map(p => `\`${p.nick}\``).join(', ')}`);
        } else {
            pickup.teams.forEach(team => {
                const teamName = team.name;
                prevFormattedTeams.push(`**Team ${teamName}**: ${team.players.map(p => `\`${p.nick}\``).join(', ')}`);
            });
        }

        return message.channel.send(
            `Bot generated teams vs current teams for pickup **#${pickup.id}** - **${pickup.name}** (Current player ratings)\n` +
            `**Current**\n${prevFormattedTeams.join('\n')}\n\n` +
            `**Bot teams**\n${formattedTeams.join('\n')}`
        );
    }
}

module.exports = command;