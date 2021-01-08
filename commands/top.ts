import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'top',
    category: 'info',
    shortDesc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    desc: 'Shows top 10 players based on amount of played pickups or elo ratings',
    args: [
        { name: '[day/week/month/year/elo]', desc: 'Period of players with most pickups as: day, week, month, year or elo to see elo rankings', required: false }
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

            if (!['day', 'week', 'month', 'year', 'elo'].includes(option)) {
                return message.reply('Did you mean day, week, month, year or elo?');
            }

            let top;
            let isElo = false;

            if (option === 'elo') {
                isElo = true;
                top = await StatsModel.getTopRatings(BigInt(message.guild.id));
            } else {
                top = await StatsModel.getTopPickupAmount(BigInt(message.guild.id), option, 10);
            }

            if (!top.length) {
                return message.reply(`no ${isElo ? 'ratings' : 'pickups'} found`);
            }

            message.channel.send(
                `**Top 10 Players - ${isElo ? 'Ratings' : `Played (${option})`}**\n` +
                `${top.map(player => `\`${player.nick}\` (**${isElo ? `${Util.tsToEloNumber(player.rating)} ± ${Util.tsToEloNumber(player.variance)}` : player.amount}**)`).join(' ')}`);
        }
    }
}

module.exports = command;