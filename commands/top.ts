import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'top',
    category: 'info',
    shortDesc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    desc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    args: [
        { name: '[day/week/month/year]', desc: 'Period of players with most pickups as: day, week, month, or year', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {

        if (!params.length) {
            const top = await StatsModel.getTopPickupAmount(BigInt(message.guild.id), 'alltime', 10);

            if (!top.length) {
                return message.reply('no pickups found');
            }

            message.channel.send(
                `**Top 10 Players (amount played)**\n` +
                `${top.map(player => `\`${player.nick}\` (**${player.amount}**)`).join(' ')}`);
        } else {
            const option = params[0].toLowerCase();

            if (!['day', 'week', 'month', 'year'].includes(option)) {
                return message.reply('Did you mean day, week, month or year?');
            }

            const top = await StatsModel.getTopPickupAmount(BigInt(message.guild.id), option, 10);

            if (!top.length) {
                return message.reply(`no pickups found`);
            }

            message.channel.send(
                `**Top 10 Players - Played**\n` +
                `${top.map((player, index) => `**#${index + 1}** \`${player.nick}\` (**${player.amount}**)`).join(' ')}`);
        }
    }
}

module.exports = command;