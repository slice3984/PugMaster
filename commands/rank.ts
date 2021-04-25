import Discord from 'discord.js';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'rank',
    category: 'info',
    shortDesc: 'Shows skill ratings and ranks of a given player',
    desc: 'Shows skill ratings and ranks of a given player',
    args: [
        { name: '<player>', desc: 'ping', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        const config = ConfigTool.getConfig();
        const identifier = params.join(' ').toLowerCase();

        const players = await PlayerModel.getPlayer(BigInt(message.guild.id), identifier);

        if (!players) {
            return message.reply('no player found with the given identifier');
        }

        if (players.players.length > 1) {
            if (players.oldNick) {
                return message.reply(`no player found with such name as current name, found multiple names in the name history, try calling the command with the player id again`);

            } else {
                return message.reply(`found multiple players using the given name, try calling the command with the player id again`);
            }
        }

        const ratings = await StatsModel.getPlayerRatings(BigInt(message.guild.id), BigInt(players.players[0].userId));

        if (!ratings) {
            return message.reply('no rated games found for this player');
        }

        const pickupNames = [];
        const playerGames = [];
        const playerRatings = [];

        ratings.ratings.forEach(pickup => {
            const rating = `${Util.tsToEloNumber(pickup.rating)} ± ${Util.tsToEloNumber(pickup.variance)}`;
            const globalRank = pickup.globalRank ? `#${pickup.globalRank}` : 'Inactive';

            pickupNames.push(`**${pickup.pickup}** - **${globalRank}**`);
            playerGames.push(`**${pickup.wins}** / **${pickup.draws}** / **${pickup.losses}**`);
            playerRatings.push(`**${rating}**`);
        })

        const rankCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`Stats - "${players.players[0].currentNick}"`)
            .addField('Rated games ', ratings.pickupCount)
            .addFields(
                { name: 'Pickup / Rank', value: pickupNames.join('\n'), inline: true },
                { name: 'W / D / L', value: playerGames.join('\n'), inline: true },
                { name: 'Rating', value: playerRatings.join('\n'), inline: true }
            );

        message.channel.send(rankCardEmbed);
    }
}

module.exports = command;