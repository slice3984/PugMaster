import { Command } from '../core/types';
import StatsModel from '../models/stats';
import Util from '../core/util';
import PlayerModel from '../models/player';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'lastgame',
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

            const timeDif = new Date().getTime() - pickup.startedAt.getTime();
            message.channel.send(`#${pickup.id} ${pickup.name} - ${Util.formatTime(timeDif)} ago: ${pickup.playerNicks.join(', ')}`);
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

                const timeDif = new Date().getTime() - pickup.startedAt.getTime();
                return message.channel.send(`#${pickup.id} ${pickup.name} - ${Util.formatTime(timeDif)} ago: ${pickup.playerNicks.join(', ')}`);
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

                const timeDif = new Date().getTime() - pickup.startedAt.getTime();
                return message.channel.send(`#${pickup.id} ${pickup.name} - ${Util.formatTime(timeDif)} ago: ${pickup.playerNicks.join(', ')}`);
            }
        }
    }
}

module.exports = command;