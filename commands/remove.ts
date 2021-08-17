import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import PickupState from '../core/pickupState';
import Util from '../core/util';
import { ApplicationCommandOptionData, GuildMember } from 'discord.js';
import Bot from '../core/bot';

const command: Command = {
    cmd: 'remove',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to remove from',
                    type: 'STRING',
                    choices: []
                }
            ];

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
    category: 'pickup',
    aliases: ['-'],
    shortDesc: 'Remove from one or multiple pickups',
    desc: 'Remove from one or multiple pickups',
    args: [
        { name: '[pickup]...', desc: 'Name of the pickup', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        // Don't allow removes when the player is added to a pending pickup in picking stage
        const isInPendingState = await PickupModel.isPlayerAddedToPendingPickup(BigInt(guild.id), BigInt(member.id), 'picking_manual', 'mapvote', 'captain_selection');

        if (isInPendingState) {
            return Util.send(message ? message : interaction, 'error', 'you are not allowed to remove from pickups in pending stage');
        }

        if (params.length === 0) {
            // Remove from all pickups
            await PickupState.removePlayer(guild.id, member.id, interaction);
            return;
        }

        const existingPickups = await PickupModel.areValidPickups(BigInt(guild.id), false, ...params);

        if (!existingPickups.length) {
            return;
        }

        const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(guild.id), BigInt(member.id), ...existingPickups.map(pickup => pickup.id));
        const validPickups = existingPickups.filter(pickup => playerAddedTo.includes(pickup.id));

        if (existingPickups.length === 0 || validPickups.length === 0) {
            if (interaction) {
                await Util.send(interaction, 'error', `you are not added to pickup **${params[0]}**`)
            }
            return;
        }

        await PickupState.removePlayer(guild.id, member.id, interaction, true, ...validPickups.map(pickup => pickup.id));
    }
}

module.exports = command;