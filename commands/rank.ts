import Discord, { ApplicationCommandOptionType } from 'discord.js';
import Bot from '../core/bot';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';
import StatsModel from '../models/stats';

const command: Command = {
    cmd: 'rank',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'player',
                    description: 'Player to get ranks for',
                    type: ApplicationCommandOptionType.User,
                    required: true
                }
            ];
        }
    },
    category: 'info',
    shortDesc: 'Shows skill ratings and ranks of a given player',
    desc: 'Shows skill ratings and ranks of a given player',
    args: [
        { name: '<player>', desc: 'ping', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const guildSettings = Bot.getInstance().getGuild(guild.id);
        const config = ConfigTool.getConfig();
        const emojis = config.emojis;
        const identifier = params.join(' ').toLowerCase();

        const players = await PlayerModel.getPlayer(BigInt(guild.id), identifier);

        if (!players) {
            if (interaction) {
                return Util.send(interaction, 'info', 'given player played no pickups');
            } else {
                return message.channel.send(Util.formatMessage('error', `${message.author}, no player found with the given identifier`));
            }
        }

        if (players.players.length > 1) {
            if (players.oldNick) {
                return Util.send(message ? message : interaction, 'info', 'no player found with such name as current name, found multiple names in the name history, try calling the command with the player id again');

            } else {
                return Util.send(message ? message : interaction, 'info', 'found multiple players using the given name, try calling the command with the player id again');
            }
        }

        const ratings = await StatsModel.getPlayerRatings(BigInt(guild.id), BigInt(players.players[0].userId));

        if (!ratings) {
            return Util.send(message ? message : interaction, 'info', `no rated games found for **${players.players[0].currentNick}**`);
        }

        const pickupNames = [];
        const playerGames = [];
        const playerRatings = [];

        ratings.ratings.forEach(pickup => {
            const rating = `${Util.tsToEloNumber(pickup.rating)} ± ${Util.tsToEloNumber(pickup.variance)}`;
            const globalRank = pickup.globalRank ? `#${pickup.globalRank}` : 'Inactive';
            const amountOfGames = +pickup.wins + +pickup.draws + +pickup.losses;
            const winPercentage = Math.round((+pickup.wins / amountOfGames) * 100);

            pickupNames.push(`**${pickup.pickup}** - **${globalRank}**`);
            playerGames.push(`**${pickup.wins}** / **${pickup.draws}** / **${pickup.losses}** **(${winPercentage}%)**`);

            const rankCap = pickup.rankRatingCap || guildSettings.maxRankRatingCap;

            let rankIcon;

            if (amountOfGames < 10 || !pickup.globalRank) {
                rankIcon = emojis.unranked;
            } else {
                rankIcon = emojis[`rank_${Util.tsToRankIcon(pickup.rating, pickup.variance, rankCap)}`];
            }

            playerRatings.push(`${rankIcon} **${rating}**`);
        })

        const botAvatarUrl = guild.client.user.avatarURL();

        const rankCardEmbed = new Discord.EmbedBuilder()
            .setColor('#126e82')
            .setTitle(`Ranking - ${Util.removeMarkdown(players.players[0].currentNick)}`)
            .addFields([{ name: 'Rated games ', value: ratings.pickupCount.toString() }])
            .addFields(
                { name: 'Pickup / Rank', value: pickupNames.join('\n'), inline: true },
                { name: 'W / D / L', value: playerGames.join('\n'), inline: true },
                { name: 'Rating', value: playerRatings.join('\n'), inline: true }
            )
            .setFooter({ text: 'Active in last 14 days / 10 games required to be ranked', iconURL: botAvatarUrl});

        if (interaction) {
            interaction.reply({ embeds: [rankCardEmbed] });
        } else {
            message.channel.send({ embeds: [rankCardEmbed] });
        }
    }
}

module.exports = command;