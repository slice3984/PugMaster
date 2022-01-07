import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import Util from '../core/util';
import { ApplicationCommandOptionData } from 'discord.js';
import Bot from '../core/bot';

const command: Command = {
    cmd: 'who',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to display added players for',
                    type: 'STRING',
                    required: false,
                    choices: []
                }
            ]

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();

            enabledPickups.forEach(pickup => {
                options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
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
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]: ${pickup.players.map(player => `\`${Util.removeMarkdown(player.nick)}\``).join(', ')}`;

        if (params.length === 0) {
            const pickups = Array.from((await PickupModel.getActivePickups(BigInt(guild.id))).values())
                .sort((a, b) => b.players.length - a.players.length);

            if (pickups.length === 0) {
                return Util.send(message ? message : interaction, 'info', 'No active pickups', false);
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

            Util.send(message ? message : interaction, null, msg, false);
        } else {
            const pickupName = params[0].toLowerCase();

            const pickup = Array.from((await PickupModel.getActivePickups(BigInt(guild.id))).values())
                .filter(pickup => pickup.name === pickupName);

            if (!pickup.length) {
                return Util.send(message ? message : interaction, 'info', `no results for **${pickupName}**`);
            }

            Util.send(message ? message : interaction, 'info', genPickupInfo(pickup[0]), false);
        }
    }
};

module.exports = command;