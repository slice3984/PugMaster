import { GuildMember } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'top',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'all-time',
                    description: 'All time top 10 players',
                    type: 'SUB_COMMAND'
                },
                {
                    name: 'period',
                    description: 'Rankings based on time period',
                    type: 'SUB_COMMAND',
                    options: [
                        {
                            name: 'period',
                            description: 'Time period for top rankings',
                            type: 'STRING',
                            required: true,
                            choices: [
                                { name: 'Day', value: 'day' },
                                { name: 'Week', value: 'week' },
                                { name: 'Month', value: 'month' },
                                { name: 'Year', value: 'year' }
                            ]
                        }
                    ]
                }
            ]
        }
    },
    category: 'info',
    shortDesc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    desc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    args: [
        { name: '[day/week/month/year]', desc: 'Period of players with most pickups as: day, week, month, or year', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        if (!params.length) {
            const top = await StatsModel.getTopPickupAmount(BigInt(guild.id), 'alltime', 10);

            if (!top.length) {
                return Util.send(message ? message : interaction, 'warn', 'no pickup records found on this server');
            }

            Util.send(message ? message : interaction, 'info',
                `**Top 10 Players (amount played)**\n` +
                `${top.map(player => `\`\`${Util.removeMarkdown(player.nick)}\`\` (**${player.amount}**)`).join(' ')}`, false);
        } else {
            const option = params[0].toLowerCase();

            if (!['day', 'week', 'month', 'year'].includes(option)) {
                return Util.send(message ? message : interaction, 'error', 'did you mean **day**, **week**, **month** or **year**?');
            }

            const top = await StatsModel.getTopPickupAmount(BigInt(guild.id), option, 10);

            if (!top.length) {
                return Util.send(message ? message : interaction, 'info', 'no pickups found');
            }

            Util.send(message ? message : interaction, 'info',
                `**Top 10 Players - Played**\n` +
                `${top.map((player, index) => `**#${index + 1}** \`\`${Util.removeMarkdown(player.nick)}\`\` (**${player.amount}**)`).join(' ')}`, false);
        }
    }
}

module.exports = command;