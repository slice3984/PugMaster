import Discord, { ApplicationCommandOptionData } from 'discord.js';
import Bot from '../core/bot';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'leaderboard',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to retrieve leaderboard for',
                    type: 'STRING',
                    required: true,
                    choices: []
                },
                {
                    name: 'page',
                    description: 'Leaderboard page',
                    type: 'NUMBER',
                }
            ]

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();
            const ratedPickups = enabledPickups.filter(pickup => pickup.rated);

            ratedPickups.forEach(pickup => {
                options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
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
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const guildSettings = Bot.getInstance().getGuild(guild.id);
        const emojis = ConfigTool.getConfig().emojis;
        let page;

        if (params.length > 1) {
            if (!/^\d+$/.test(params[1].toString())) {
                return Util.send(message ? message : interaction, 'error', 'leaderboard page has to be a number');
            }

            page = +params[1] === 1 ? null : +params[1];
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), params[0], true);

        if (!pickupSettings) {
            return Util.send(message ? message : interaction, 'error', 'given pickup not found');
        }

        if (!pickupSettings.rated) {
            return Util.send(message ? message : interaction, 'warn', 'given pickup is not rated, no leaderboard available');
        }

        const ratings = await StatsModel.getLeaderboardRatings(pickupSettings.id, page ? page : 1);

        if (!ratings) {
            if (!page) {
                return Util.send(message ? message : interaction, 'warn', 'there are no ratings stored for this pickup');

            } else {
                return Util.send(message ? message : interaction, 'warn', 'there are no ratings stored for this pickup in general or for this page');
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

        const botAvatarUrl = guild.client.user.avatarURL();

        const leaderboardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`Leaderboard - ${ratings.pickup}${page ? ` [Page ${page}]` : ''}`)
            .addFields(
                { name: 'Player', value: playerNicks.join('\n'), inline: true },
                { name: 'W / D / L', value: playerGames.join('\n'), inline: true },
                { name: 'Rating', value: playerRatings.join('\n'), inline: true },
            ).setFooter('Player skill uncertainty taken into account for ranking.\nActive in last 14 days / 10 games required to be ranked', botAvatarUrl)

        if (interaction) {
            interaction.reply({ embeds: [leaderboardEmbed] });
        } else {
            message.channel.send({ embeds: [leaderboardEmbed] });
        }
    }
}

module.exports = command;