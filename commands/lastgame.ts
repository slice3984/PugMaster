import { Command, PickupInfo } from '../core/types';
import StatsModel from '../models/stats';
import Util from '../core/util';
import PlayerModel from '../models/player';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'lastgame',
    category: 'info',
    aliases: ['lg'],
    shortDesc: 'Show the overall last game or by pickup/player',
    desc: 'Show the overall last game or by pickup/player',
    args: [
        { name: '[pickup/player]...', desc: 'Name of the pickup or player identifier (id or nick)', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        if (params.length === 0) {
            // Last overall game
            const pickup = await StatsModel.getLastGame(BigInt(message.guild.id));

            if (!pickup) {
                return message.channel.send(`no pickups stored`);
            }

            message.channel.send(formatOutput(pickup));
        } else {
            const identifier = params.join(' ');
            let pickup;

            // Check for valid pickup
            const gotPickup = await PickupModel.areValidPickups(BigInt(message.guild.id), identifier.toLowerCase());

            if (gotPickup.length) {
                pickup = await StatsModel.getLastGame(BigInt(message.guild.id), { isPlayer: false, value: identifier.toLowerCase() });

                if (!pickup) {
                    return message.reply('no pickup stored');
                }
                message.channel.send(formatOutput(pickup));
            } else {
                // Check for player
                const nicks = await PlayerModel.getPlayer(BigInt(message.guild.id), identifier);

                if (!nicks) {
                    return message.reply('given player not stored');
                }

                if (nicks.players.length > 1) {
                    if (nicks.oldNick) {
                        return message.reply(`no player found with such name as current name, found multiple names in the name history, try calling the command with the player id again`);

                    } else {
                        return message.reply(`found multiple players using the given name, try calling the command with the player id again`);
                    }
                }

                pickup = await StatsModel.getLastGame(BigInt(message.guild.id), { isPlayer: true, value: nicks.players[0].id });

                if (!pickup) {
                    const nick = nicks.oldNick ? `${nicks.players[0].currentNick} (Old name: ${nicks.players[0].oldNick})` : nicks.players[0].currentNick;
                    return message.reply(`${nick} played no pickups`);
                }

                return message.channel.send(formatOutput(pickup, nicks.players[0].currentNick));
            }
        }
    }
}

const formatOutput = (pickupInfo: PickupInfo, toHighlight?: string | null) => {
    const formatPlayers = (players: { nick: string; isCaptain: boolean }[], onePlayerTeams: boolean) => {
        players = players.sort((p1, p2) => {
            return +p2.isCaptain - +p1.isCaptain;
        });

        return players.map(p => {
            let playerStr = '';
            if (toHighlight && p.nick === toHighlight) {
                playerStr += `**>**\`${p.nick}\``;
            } else {
                playerStr += `\`${p.nick}\``;
            }

            // Ignore duels
            if (p.isCaptain && !onePlayerTeams) {
                playerStr += ' (Captain)';
            }

            return playerStr;
        });
    }

    const timeDif = new Date().getTime() - pickupInfo.startedAt.getTime();
    let str = `Pickup **#${pickupInfo.id}** - **${pickupInfo.name}** - ${Util.formatTime(timeDif)} ago`;

    if (pickupInfo.teams.length > 1) {
        // 1 player per team pickups are considered as duel
        if (pickupInfo.teams[0].players.length === 1) {
            const nicks = formatPlayers(pickupInfo.teams.flatMap(t => t.players), true).join(' **vs** ');
            str += `\nPlayers: ${nicks}`;
        } else {
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
                str += `\n**Team ${team.name}${outcomeString}**: ${nicks}`;
            });
        }
    } else {
        str += `\nPlayers: ${formatPlayers(pickupInfo.teams.flatMap(t => t.players), false).join(', ')}`;
    }

    return str;
}

module.exports = command;