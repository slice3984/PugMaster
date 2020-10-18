import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import PickupState from '../core/pickupState';

const command: Command = {
    cmd: 'remove',
    category: 'pickup',
    aliases: ['-'],
    shortDesc: 'Remove from one or multiple pickups',
    desc: 'Remove from one or multiple pickups',
    args: [
        { name: '[pickup]...', desc: 'Name of the pickup', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        // Don't allow removes when the player is added to a pending pickup in picking stage
        const isInPickingStage = await PickupModel.isPlayerAddedToPendingPickup(BigInt(message.guild.id), BigInt(message.member.id), 'picking_manual');

        if (isInPickingStage) {
            return message.reply('you are not allowed to remove from pickups in picking phase');
        }

        if (params.length === 0) {
            // Remove from all pickups
            await PickupState.removePlayer(message.guild.id, message.member.id);
            return;
        }

        const existingPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...params);

        if (!existingPickups.length) {
            return;
        }

        const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(message.member.id), ...existingPickups.map(pickup => pickup.id));
        const validPickups = existingPickups.filter(pickup => playerAddedTo.includes(pickup.id));

        if (existingPickups.length === 0 || validPickups.length === 0) {
            return;
        }

        await PickupState.removePlayer(message.guild.id, message.member.id, true, ...validPickups.map(pickup => pickup.id));
    }
}

module.exports = command;