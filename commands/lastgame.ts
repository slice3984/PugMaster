import { Command, PickupInfo } from '../core/types';
import StatsModel from '../models/stats';
import Util from '../core/util';
import PlayerModel from '../models/player';
import PickupModel from '../models/pickup';
import Bot from '../core/bot';
import { ApplicationCommandOptionData, ApplicationCommandOptionType, EmbedBuilder } from 'discord.js';

const command: Command = {
    cmd: 'lastgame',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'latest',
                    description: 'Latest played pickup in general',
                    type: ApplicationCommandOptionType.Subcommand,
                },
                {
                    name: 'pickup',
                    description: 'Lastgame for a pickup',
                    type: 'SUB_COMMAND',
                    options: [
                        {
                            name: 'pickup',
                            description: 'Pickup to get lastgame for',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: []
                        }
                    ]
                },
                {
                    name: 'player',
                    description: 'Lastgame for a player',
                    type: 'SUB_COMMAND',
                    options: [
                        {
                            name: 'player',
                            description: 'Player to get lastgame for',
                            type: ApplicationCommandOptionType.User,
                            required: true
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
    aliases: ['lg'],
    shortDesc: 'Show the overall last game or by pickup/player',
    desc: 'Show the overall last game or by pickup/player',
    args: [
        { name: '[pickup/player]...', desc: 'Name of the pickup or player identifier (id or nick)', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        if (params.length === 0) {
            // Last overall game
            const pickup = await StatsModel.getLastGame(BigInt(guild.id));

            if (!pickup) {
                return Util.send(message ? message : interaction, 'info', 'No pickups stored', false);
            }

            if (interaction) {
                interaction.reply({ embeds: [formatOutput(pickup)] });
            } else {
                message.channel.send({ embeds: [formatOutput(pickup)] });
            }
        } else {
            const identifier = params.join(' ');
            let pickup;

            // Check for valid pickup
            const gotPickup = await PickupModel.areValidPickups(BigInt(guild.id), true, identifier.toLowerCase());

            if (gotPickup.length) {
                pickup = await StatsModel.getLastGame(BigInt(guild.id), { isPlayer: false, value: identifier.toLowerCase() });

                if (!pickup) {
                    return Util.send(message ? message : interaction, 'info', `No pickup stored for **${identifier.toLowerCase()}**`, false);
                }

                if (interaction) {
                    interaction.reply({ embeds: [formatOutput(pickup)] });
                } else {
                    message.channel.send({ embeds: [formatOutput(pickup)] });
                }
            } else {
                // Check for player
                const nicks = await PlayerModel.getPlayer(BigInt(guild.id), identifier);

                if (!nicks) {
                    return Util.send(interaction ? interaction : message, 'info', `Player **${identifier}** not found`);
                }

                if (nicks.players.length > 1) {
                    if (nicks.oldNick) {
                        return Util.send(message ? message : interaction, 'info', `Player **${identifier}** not found`);
                    } else {
                        return Util.send(message ? message : interaction, 'info', 'No player found with such name as current name, found multiple names in the name history, try calling the command with the player id again');
                    }
                }

                pickup = await StatsModel.getLastGame(BigInt(guild.id), { isPlayer: true, value: nicks.players[0].id });

                if (!pickup) {
                    const nick = nicks.oldNick ? `${nicks.players[0].currentNick} (Old name: ${nicks.players[0].oldNick})` : nicks.players[0].currentNick;
                    return Util.send(message ? message : interaction, 'info', `No pickups found for **${nick}**`, false);
                }

                if (interaction) {
                    return interaction.reply({ embeds: [formatOutput(pickup, nicks.players[0].currentNick)] });
                } else {
                    return message.channel.send({ embeds: [formatOutput(pickup, nicks.players[0].currentNick)] });
                }
            }
        }
    }
}

const formatOutput = (pickupInfo: PickupInfo, toHighlight?: string | null) => {
    const formatPlayers = (players: { nick: string; isCaptain: boolean, outcome?: 'win' | 'draw' | 'loss' }[], onePlayerTeams: boolean) => {
        players = players.sort((p1, p2) => {
            return +p2.isCaptain - +p1.isCaptain;
        });

        return players.map(p => {
            let playerStr = '';
            if (toHighlight && p.nick === toHighlight) {
                playerStr += `**>**\`\`${Util.removeMarkdown(p.nick)}\`\``;
            } else {
                playerStr += `\`\`${Util.removeMarkdown(p.nick)}\`\``;
            }

            if (onePlayerTeams && p.outcome) {
                switch (p.outcome) {
                    case 'win': playerStr += ' (**WON**)'; break;
                    case 'draw': playerStr += ' (**DREW**)'; break;
                    case 'loss': playerStr += ' (**LOST**)';
                }
            }

            // Ignore duels
            if (p.isCaptain && !onePlayerTeams) {
                playerStr += ' (Captain)';
            }


            return playerStr;
        });
    }

    const timeDif = new Date().getTime() - pickupInfo.startedAt.getTime();

    const embedFields = [
        { name: 'Time', value: `${Util.formatTime(timeDif)} ago`, inline: true }
    ];

    // Map
    if (pickupInfo.map) {
        embedFields.push({ name: 'Map', value: pickupInfo.map, inline: true });
    }

    // Rated
    if (!pickupInfo.isRated) {
        if (!pickupInfo.map) {
            embedFields.push({ name: '\u200B', value: '\u200B', inline: true });
        }

        embedFields.push({ name: '\u200B', value: '\u200B', inline: true });
    } else {
        let ratedStr = '';

        if (pickupInfo.isRated && pickupInfo.teams[0].outcome) {
            ratedStr = 'Yes';
        } else if (pickupInfo.isRated && !pickupInfo.teams[0].outcome) {
            ratedStr = 'Rateable'
        }

        embedFields.push({ name: 'Rated', value: ratedStr, inline: true });

        if (!pickupInfo.map) {
            embedFields.push({ name: '\u200B', value: '\u200B', inline: true });
        }
    }

    const lastGameCard = new EmbedBuilder()
        .setTitle(`Pickup **#${pickupInfo.id}** - **${pickupInfo.name}**`)
        .setColor('#126e82')
        .addFields(embedFields);

    if (pickupInfo.teams.length > 1) {
        // 1 player per team pickups are considered as duel
        if (pickupInfo.teams[0].players.length === 1) {
            const nicks = formatPlayers(pickupInfo.teams.flatMap(t => t.players.map(p => ({ ...p, outcome: t.outcome }))), true).join(' **vs** ');
            lastGameCard.addFields([ {name: 'Players', value: nicks, inline: false}]);
        } else {
            const teamStrs = [];

            pickupInfo.teams.forEach(team => {
                const nicks = formatPlayers(team.players, false).join(', ');
                let outcomeString = '';
                if (team.outcome) {
                    switch (team.outcome) {
                        case 'win': outcomeString = ' - WON'; break;
                        case 'draw': outcomeString = ' - DREW'; break;
                        case 'loss': outcomeString = ' - LOST';
                    }
                }
                teamStrs.push(`**${team.name}${outcomeString}**: ${nicks}`);
            });

            lastGameCard.addFields([{ name: 'Teams', value: teamStrs.join('\n'), inline: false }]);
        }
    } else {
        lastGameCard.addFields([{ name: 'Players', value: formatPlayers(pickupInfo.teams.flatMap(t => t.players), false).join(', '), inline: false}] );
    }

    return lastGameCard;
}

module.exports = command;