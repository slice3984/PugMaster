import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import PickupState from '../core/pickupState';
import Util from '../core/util';

const command: Command = {
    cmd: 'remove_pickups',
    category: 'admin',
    shortDesc: 'Remove one or multiple pickups',
    desc: 'Remove one or multiple pickups',
    args: [
        { name: '<pickup>...', desc: 'Pickup names', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const pickups = params.map(param => param.toLowerCase());

        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...pickups);

        if (!validPickups.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no valid pickups provided`));
        }

        const activePickups = Array.from(await (await (await PickupModel.getActivePickups(BigInt(message.guild.id))).values()));

        const filteredPickups = activePickups.filter(pickup => validPickups.map(pu => pu.id).includes(pickup.configId));

        // If the players is added at one of them as well, keep the state
        const untouchedPickups = activePickups.filter(pickup => !validPickups.map(pu => pu.id).includes(pickup.configId));

        let playersAddedTargetPickups = [];
        let playersAddedLeftPickups = [];

        untouchedPickups.forEach(pickup => {
            const players = pickup.players.map(player => player.id);
            playersAddedLeftPickups.push(...players);
        });

        filteredPickups.forEach(pickup => {
            const players = pickup.players.map(player => player.id);
            playersAddedTargetPickups.push(...players);
        });

        const playersToRemoveState = playersAddedTargetPickups.filter(playerId => !playersAddedLeftPickups.includes(playerId));

        if (playersToRemoveState.length) {
            await GuildModel.resetPlayerStates(BigInt(message.guild.id), ...playersToRemoveState);
        }

        await PickupModel.removePickups(BigInt(message.guild.id), ...validPickups.map(pickup => pickup.id));

        await message.channel.send(Util.formatMessage('success', `Removed **${validPickups.length}** pickup${validPickups.length > 1 ? 's' : ''} (${validPickups.map(pickup => `**${pickup.name}**`).join(' ')})`));

        if (filteredPickups.length) {
            await PickupState.showPickupStatus(message.guild);
        }
    }
}

module.exports = command;