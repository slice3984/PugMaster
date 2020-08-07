import { Command } from '../core/types';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'top',
    shortDesc: 'Shows top 10 players based on amount of played pickups',
    desc: 'Shows top 10 players based on amount of played pickups',
    args: [
        { name: '[day/week/month/year]', desc: 'Period of top players, last day, week, month or year', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {

        if (!params.length) {
            const top = await StatsModel.getTop(BigInt(message.guild.id), 'alltime', 10);

            if (!top.length) {
                return message.reply('no pickups found');
            }

            message.channel.send(
                `**Top 10 Players (amount played)**\n` +
                `${top.map(player => `\`${player.nick}\` (**${player.amount}**)`).join(' ')}`);
        } else {
            const time = params[0].toLowerCase();

            if (!['day', 'week', 'month', 'year'].includes(time)) {
                return message.reply('invalid time period given did you mean: day, week, month or year?');
            }

            const top = await StatsModel.getTop(BigInt(message.guild.id), time, 10);

            if (!top.length) {
                return message.reply('no pickups found');
            }

            message.channel.send(
                `**Top 10 Players - ${time} (amount played)**\n` +
                `${top.map(player => `\`${player.nick}\` (**${player.amount}**)`).join(' ')}`);
        }
    }
}

module.exports = command;