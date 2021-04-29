import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'subscribe',
    category: 'pickup',
    shortDesc: 'Subscribe to one or multiple pickus to get notified on promotions',
    desc: 'Subscribe to one or multiple pickus to get notified on promotions',
    args: [
        { name: '<pickup>...', desc: 'The pickups you want to subscribe to', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...params);

        if (!validPickups.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no valid pickups provided`));
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToSubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(message.guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToSubscribe.length) {
            return message.channel.send(Util.formatMessage('warn', `${message.author}, given valid pickups got no promotion role`));
        }

        const userRoleIds = message.member.roles.cache.map(role => role.id);

        pickupsToSubscribe = pickupsToSubscribe.filter(pickup => !userRoleIds.includes(pickup.promotionRole));

        if (!pickupsToSubscribe.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are already subscribed to the given valid pickups`));
        }

        pickupsToSubscribe.filter(pickup => {
            if (message.guild.roles.cache.get(pickup.promotionRole.toString())) {
                return true;
            } else {
                return false;
            }
        });

        if (!pickupsToSubscribe.length) {
            return message.channel.send(Util.formatMessage('error', `Stored promotion roles for provided valid pickups not found`));
        }

        try {
            await message.member.roles.add(pickupsToSubscribe.map(pickup => pickup.promotionRole.toString()))
        } catch (_err) {
            return message.channel.send(Util.formatMessage('error', 'Not able to set one or multiple roles, are the required permission given, do the roles exist?'));
        }

        message.channel.send(Util.formatMessage('success', `${message.author}, subscribed to ${pickupsToSubscribe.map(pickup => `**${pickup.name}**`).join(', ')}`));
    }
}

module.exports = command;