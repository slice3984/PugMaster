import { Command } from '../core/types';
import StatsModel from '../models/stats';
import PlayerModel from '../models/player';
import Util from '../core/util';

const command: Command = {
    cmd: 'stats',
    category: 'info',
    shortDesc: 'Shows the stats for a given pickup/player or all pickups in general',
    desc: 'Shows the stats for a given pickup/player or all pickups in general',
    args: [
        { name: '[pickup/player]', desc: 'Pickup or player', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        const identifier = params.join(' ').toLowerCase();

        // All stats
        if (!identifier.length) {
            const stats = await StatsModel.getStats(BigInt(message.guild.id));

            if (!stats.length) {
                return message.reply('no pickups stored');
            }

            return message.channel.send(stats.map(pickup => `\`${pickup.name}\` (**${pickup.amount}**)`).join(' '));
        }

        // Try pickup
        const stats = await StatsModel.getStats(BigInt(message.guild.id), identifier);

        if (stats.length) {
            const name = stats[0].name;
            const amount = stats[0].amount;

            return message.channel.send(`${amount} **${name}** pickup${amount > 1 ? 's' : ''} played`);
        } else {
            // By player
            const players = await PlayerModel.getPlayer(BigInt(message.guild.id), identifier);

            if (!players) {
                return message.reply('no pickup or player found with the given identifier');
            }

            if (players.players.length > 1) {
                if (players.oldNick) {
                    return message.reply(`no player found with such name as current name, found multiple names in the name history, try calling the command with the player id again`);

                } else {
                    return message.reply(`found multiple players using the given name, try calling the command with the player id again`);
                }
            }

            const stats = await StatsModel.getStats(BigInt(message.guild.id), players.players[0].id);
            const info = await StatsModel.getPlayerInfo(BigInt(message.guild.id), BigInt(players.players[0].userId));

            if (!stats.length) {
                return message.reply('no pickup records found for this player');
            }

            const msg = `Stats for **${stats[0].nick}**\n` +
                `**Elo:** ${info.rating ? `${Util.tsToEloNumber(info.rating)} ± ${Util.tsToEloNumber(info.variance)}` : '-'}\n` +
                `**Pickups:** ${stats.map(pickup => `\`${pickup.name}\` (**${pickup.amount}**)`).join(' ')}`;

            message.channel.send(msg);
        }
    }
}

module.exports = command;