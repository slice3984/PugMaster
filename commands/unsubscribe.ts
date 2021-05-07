import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'unsubscribe',
    category: 'pickup',
    shortDesc: 'Unsubscribe from one or multiple pickups',
    desc: 'Unsubscribe from one or multiple pickups',
    args: [
        { name: '<pickup>...', desc: 'The pickups you want to unsubscribe from', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), true, ...params);

        if (!validPickups.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no valid pickups provided`));
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToUnsubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(message.guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToUnsubscribe.length) {
            return message.channel.send(Util.formatMessage('warn', `${message.author}, given valid pickups got no promotion role`));
        }

        const userRoleIds = message.member.roles.cache.map(role => role.id);

        pickupsToUnsubscribe = pickupsToUnsubscribe.filter(pickup => userRoleIds.includes(pickup.promotionRole));

        if (!pickupsToUnsubscribe.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are already not subscribed to the given valid pickups`));
        }

        try {
            await message.member.roles.remove(pickupsToUnsubscribe.map(pickup => pickup.promotionRole.toString()));
        } catch (_err) {
            return message.channel.send(Util.formatMessage('error', 'Not able to remove one or multiple roles, are the required permission given, do the roles exist?'));
        }

        message.channel.send(Util.formatMessage('success', `${message.author}, unsubscribed from ${pickupsToUnsubscribe.map(pickup => `**${pickup.name}**`).join(', ')}`));
    }
}

module.exports = command;