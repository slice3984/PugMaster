import { Command } from '../core/types';
import StatsModel from '../models/stats';
import PlayerModel from '../models/player';
import Util from '../core/util';
import Bot from '../core/bot';
import { ApplicationCommandOptionData, ApplicationCommandOptionType } from 'discord.js';

const command: Command = {
    cmd: 'stats',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'all',
                    description: 'Stats for all pickups in general',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'pickup',
                    description: 'Stats for a given pickup',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'pickup',
                            description: 'Pickup to get stats for',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: []
                        }
                    ]
                },
                {
                    name: 'player',
                    description: 'Stats for a given player',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'player',
                            description: 'Player to get stats for',
                            required: true,
                            type: ApplicationCommandOptionType.User
                        }
                    ]
                }
            ]

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();

            enabledPickups.forEach(pickup => {
                // @ts-ignore
                options[1].options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
    shortDesc: 'Shows the stats for a given pickup/player or all pickups in general',
    desc: 'Shows the stats for a given pickup/player or all pickups in general',
    args: [
        { name: '[pickup/player]', desc: 'Pickup or player', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const identifier = params.join(' ').toLowerCase();

        // All stats
        if (!identifier.length) {
            const stats = await StatsModel.getStats(BigInt(guild.id));

            if (!stats.length) {
                return Util.send(message ? message : interaction, 'info', 'No pickups stored');
            }

            return Util.send(message ? message : interaction, 'info', `**Played pickups**: ${stats.map(pickup => `\`${pickup.name}\` (**${pickup.amount}**)`).join(' ')}`, false);
        }

        // Try pickup
        const stats = await StatsModel.getStats(BigInt(guild.id), identifier);

        if (stats.length) {
            const name = stats[0].name;
            const amount = stats[0].amount;

            return Util.send(message ? message : interaction, 'info', `${amount} **${name}** pickup${amount > 1 ? 's' : ''} played`, false);
        } else {
            // By player
            const players = await PlayerModel.getPlayer(BigInt(guild.id), identifier);

            if (!players) {
                if (interaction) {
                    return Util.send(interaction, 'error', 'given player not stored');
                } else {
                    return message.channel.send(Util.formatMessage('error', `${message.author}, no pickup or player found with the given identifier`));
                }
            }

            if (players.players.length > 1) {
                if (players.oldNick) {
                    return Util.send(message ? message : interaction, 'error', 'no player found with such name as current name, found multiple names in the name history, try calling the command with the player id again');

                } else {
                    return Util.send(message ? message : interaction, 'info', 'found multiple players using the given name, try calling the command with the player id again');
                }
            }

            const stats = await StatsModel.getStats(BigInt(guild.id), players.players[0].id);

            if (!stats.length) {
                return Util.send(message ? message : interaction, 'info', 'no pickup records found for this player');
            }

            const msg = `Stats for **${stats[0].nick}**\n` +
                `**Pickups:** ${stats.map(pickup => `\`${pickup.name}\` (**${pickup.amount}**)`).join(' ')}`;

            Util.send(message ? message : interaction, 'info', msg, false);
        }
    }
}

module.exports = command;