import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';
import PickupState from '../core/pickupState';

const command: Command = {
    cmd: 'add',
    aliases: ['+'],
    shortDesc: 'Add to one or multiple pickups',
    desc: 'Add to one or multiple pickups',
    args: [
        { name: '[pickup]...', desc: 'Name of the pickup', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        // TODO: Ban check / Trust check;
        if (params.length === 0) {
            if (!await PickupModel.getStoredPickupCount(BigInt(message.guild.id))) {
                return;
            }

            const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(message.member.id));
            const activeAndDefaultPickups = await (await PickupModel.getActivePickups(BigInt(message.guild.id), true)).values();

            const validPickups = [...activeAndDefaultPickups]
                .filter(pickup => !(playerAddedTo.includes(pickup.configId) || pickup.maxPlayers <= 2)) // Only autoadd on 2+ player pickups
                .map(pickup => pickup.configId);

            if (validPickups.length === 0) {
                return;
            }

            await PickupState.addPlayer(message.member, ...validPickups);

        } else {
            const existingPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...params);

            if (existingPickups.length === 0) {
                return message.reply(`Pickup${params.length > 1 ? 's' : ''} not found`);
            }

            const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(message.member.id), existingPickups.map(pickup => pickup.id));
            const validPickups = existingPickups.filter(pickup => !playerAddedTo.includes(pickup.id));

            if (validPickups.length === 0) {
                return;
            }
            await PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(message.member.id), message.member.displayName);
            await PickupState.addPlayer(message.member, ...validPickups.map(pickup => pickup.id))
        }
    }
};

module.exports = command;