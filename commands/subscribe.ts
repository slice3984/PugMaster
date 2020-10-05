import { Command } from '../core/types';
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
            return message.reply(`no valid pickups provided`);
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToSubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(message.guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToSubscribe.length) {
            return message.reply('given valid pickups got no promotion role');
        }

        const userRoleIds = message.member.roles.cache.map(role => role.id);

        pickupsToSubscribe = pickupsToSubscribe.filter(pickup => !userRoleIds.includes(pickup.promotionRole));

        if (!pickupsToSubscribe.length) {
            return message.reply('you are already subscribed to the given valid pickups');
        }

        pickupsToSubscribe.filter(pickup => {
            if (message.guild.roles.cache.get(pickup.promotionRole.toString())) {
                return true;
            } else {
                return false;
            }
        });

        if (!pickupsToSubscribe.length) {
            return message.channel.send('can\'t find the set promotion roles for the given valid pickups');
        }

        try {
            await message.member.roles.add(pickupsToSubscribe.map(pickup => pickup.promotionRole.toString()))
        } catch (_err) {
            return message.channel.send('didn\'t manage to set one or multiple roles, are the required permission given, do the roles exist?');
        }

        message.reply(`successfully subscribed to ${pickupsToSubscribe.map(pickup => pickup.name).join(', ')}`);
    }
}

module.exports = command;