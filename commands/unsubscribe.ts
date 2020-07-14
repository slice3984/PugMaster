import { Command } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'unsubscribe',
    shortDesc: 'Unsubscribe from one or multiple pickups',
    desc: 'Unsubscribe from one or multiple pickups',
    args: [
        { name: '<pickup>...', desc: 'The pickups you want to unsubscribe from', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), ...params);

        if (!validPickups.length) {
            return message.reply(`no valid pickups provided`);
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToUnsubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(message.guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToUnsubscribe.length) {
            return message.reply('given valid pickups got no promotion role');
        }

        const userRoleIds = message.member.roles.cache.map(role => BigInt(role.id));

        pickupsToUnsubscribe = pickupsToUnsubscribe.filter(pickup => userRoleIds.includes(pickup.promotionRole));

        if (!pickupsToUnsubscribe.length) {
            return message.reply('you are not subscribed to the given valid pickups');
        }

        try {
            await message.member.roles.remove(pickupsToUnsubscribe.map(pickup => pickup.promotionRole.toString()));
        } catch (_err) {
            return message.channel.send('didn\'t manage to remove one or multiple roles, are the required permission given?');
        }

        message.reply(`successfully unsubscribed from ${pickupsToUnsubscribe.map(pickup => pickup.name).join(', ')}`);
    }
}

module.exports = command;