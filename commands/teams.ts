import { Command, PickupInfo } from '../core/types';
import Util from '../core/util';
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
                return message.channel.send(Util.formatMessage('error', `${message.author}, pickup id has to be a number`));
            }

            pickup = await StatsModel.getPickup(BigInt(message.guild.id), +params[0]);

            if (!pickup) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, no pickup found for the provided id`));
            }
        } else {
            pickup = await StatsModel.getPickup(BigInt(message.guild.id));

            if (!pickup) {
                return message.channel.send(Util.formatMessage('warn', `${message.author}, there is no pickup record for this server`));
            }
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickup.name);

        if (pickupSettings.playerCount === 2) {
            return message.channel.send(Util.formatMessage('warn', `${message.author}, pickup has to be a pickup with more than two players`));
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


        // More accurate generation for <= 10 players 2 teams pickups
        if (pickupSettings.teamCount === 2 && pickupSettings.playerCount <= 10) {
            const findMinDiffPartitions = (skills, t1 = [], t2 = []) => {
                const sum = arr => arr.reduce((acc, a) => acc + a.skill, 0);

                if (skills.length <= 0) {
                    return [t1, t2];
                }

                let a = findMinDiffPartitions(skills.slice(0, -1), t1.concat(skills.slice(-1).pop()), t2);
                let b = findMinDiffPartitions(skills.slice(0, -1), t1, t2.concat(skills.slice(-1).pop()));

                if (a[0].length != a[1].length) return b;
                if (b[0].length != b[1].length) return a;

                if (Math.abs(sum(a[0]) - sum(a[1])) < Math.abs(sum(b[0]) - sum(b[1]))) {
                    return a;
                }

                return b;
            };

            const teams = findMinDiffPartitions(playerRatings);

            teams.forEach(team => {
                generatedTeams.push(team);
            });
        } else {
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