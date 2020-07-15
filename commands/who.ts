import { Command } from '../core/types';
import PlayerModel from '../models/player';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'who',
    aliases: ['??'],
    shortDesc: 'Show the pickup status of one or multiple pickups',
    desc: 'Show the pickup status of one or multiple pickups',
    args: [
        { name: '[pickup]', desc: 'Name of the pickup', required: false }
    ],
    defaults: [
        {
            type: 'string', name: 'display', desc: 'How to display the active pickups, per line, compact or dynamic based on amount',
            value: 'dynamic', possibleValues: ['dynamic', 'long', 'compact']
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]: ${pickup.players.map(player => `\`${player.nick}\``).join(', ')}`;

        if (params.length === 0) {
            const pickups = Array.from((await PickupModel.getActivePickups(BigInt(message.guild.id))).values())
                .sort((a, b) => b.players.length - a.players.length);

            if (pickups.length === 0) {
                return message.channel.send('No active pickups');
            }

            let msg = '';
            pickups.forEach((pickup, index) => {
                if (defaults[0] === 'dynamic') {
                    // Compact
                    if (pickups.length > 6) {
                        msg += `${genPickupInfo(pickup)} `;
                    } else {
                        msg += `${genPickupInfo(pickup)}`;
                        if (index < pickups.length - 1) {
                            msg += '\n';
                        }
                    }
                } else if (defaults[0] === 'long') {
                    msg += `${genPickupInfo(pickup)}`;
                    if (index < pickups.length - 1) {
                        msg += '\n';
                    }
                } else {
                    msg += `${genPickupInfo(pickup)} `;
                }
            });
            message.channel.send(msg);
        } else {
            const pickupName = params[0].toLowerCase();

            const pickup = Array.from((await PickupModel.getActivePickups(BigInt(message.guild.id))).values())
                .filter(pickup => pickup.name === pickupName);

            if (!pickup.length) {
                return message.reply(`no results for ${pickupName}`);
            }

            message.channel.send(genPickupInfo(pickup[0]));
        }
    }
};

module.exports = command;