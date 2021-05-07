import Discord from 'discord.js';
import Bot from '../core/bot';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'leaderboard',
    category: 'info',
    aliases: ['lb'],
    shortDesc: 'Shows top 10 ratings for a given rated pickup',
    desc: 'Shows top 10 ratings for a given rated pickup',
    args: [
        { name: '<pickup>', desc: 'Name of the pickup to show leaderboard of', required: true },
        { name: '[page]', desc: 'Page of the leaderboard, starts with one', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        const guildSettings = Bot.getInstance().getGuild(message.guild.id);
        const emojis = ConfigTool.getConfig().emojis;
        let page;

        if (params.length > 1) {
            if (!/^\d+$/.test(params[1])) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, leaderboard page has to be a number`));
            }

            page = +params[1] === 1 ? null : +params[1];
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), params[0], true);

        if (!pickupSettings) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given pickup not found`));
        }

        if (!pickupSettings.rated) {
            return message.channel.send(Util.formatMessage('warn', `${message.author}, given pickup is not rated, no leaderboard available`));
        }

        const ratings = await StatsModel.getLeaderboardRatings(pickupSettings.id, page ? page : 1);

        if (!ratings) {
            if (!page) {
                return message.channel.send(Util.formatMessage('warn', `${message.author}, there are no ratings stored for this pickup`));
            } else {
                return message.channel.send(Util.formatMessage('warn', `${message.author}, there are no ratings stored for this pickup in general or for this page`));
            }
        }

        const playerNicks = [];
        const playerGames = [];
        const playerRatings = [];

        ratings.ratings.forEach(player => {
            let rank = '';

            switch (player.rank) {
                case 1: rank = emojis.lb_leader; break;
                case 2: rank = ':second_place:'; break;
                case 3: rank = ':third_place:'; break;
                default: rank = `#${player.rank}`;
            }

            const name = player.nick;
            const amountOfGames = +player.wins + +player.draws + +player.losses;
            const rankCap = ratings.rankRatingCap || guildSettings.maxRankRatingCap;

            let rankIcon;

            if (amountOfGames < 10) {
                rankIcon = emojis.unranked;
            } else {
                rankIcon = emojis[`rank_${Util.tsToRankIcon(player.rating, player.variance, rankCap)}`];
            }

            const winPercentage = Math.round((+player.wins / amountOfGames) * 100);
            const rating = `${rankIcon} ${Util.tsToEloNumber(player.rating)} ± ${Util.tsToEloNumber(player.variance)}`;

            playerNicks.push(`**${rank}** ${name}`);
            playerGames.push(`**${player.wins}** / **${player.draws}** / **${player.losses}** **(${winPercentage}%)**`);
            playerRatings.push(`**${rating}**`);
        });

        const botAvatarUrl = message.guild.client.user.avatarURL();

        const leaderboardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`Leaderboard - ${ratings.pickup}${page ? ` [Page ${page}]` : ''}`)
            .addFields(
                { name: 'Player', value: playerNicks.join('\n'), inline: true },
                { name: 'W / D / L', value: playerGames.join('\n'), inline: true },
                { name: 'Rating', value: playerRatings.join('\n'), inline: true },
            ).setFooter('Player skill uncertainty taken into account for ranking.\nActive in last 14 days / 10 games required to be ranked', botAvatarUrl)

        message.channel.send(leaderboardEmbed);
    }
}

module.exports = command;