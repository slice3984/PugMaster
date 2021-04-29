import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'expire',
    category: 'pickup',
    shortDesc: 'Set or show the amount of time after you get removed from all pickups',
    desc: 'Set or show the amount of time after you get removed from all pickups',
    args: [
        { name: '[time]...', desc: 'time-short', required: false }
    ],
    defaults: [
        {
            type: 'time', name: 'max_expire', desc: 'Max expiration time',
            value: 86400000, possibleValues: { from: 300000, to: 172800000 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        if (!params.length) {
            const expireDate = await PlayerModel.getExpires(BigInt(message.guild.id), BigInt(message.member.id));
            if (!expireDate) {
                return message.channel.send(Util.formatMessage('info', `${message.author}, no expire set`));
            }

            const expiresIn = (expireDate[0].getTime() - new Date().getTime());
            return message.channel.send(Util.formatMessage('info', `${message.author}, **${Util.formatTime(expiresIn)}** left until removal`));
        }

        if (params[0].toLowerCase() === 'none') {
            const expireDate = await PlayerModel.getExpires(BigInt(message.guild.id), BigInt(message.member.id));

            if (!expireDate) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, you did not set any expire`));
            }

            await PlayerModel.removeExpires(BigInt(message.guild.id), message.member.id);
            return message.channel.send(Util.formatMessage('success', `${message.author}, your expire got removed`));
        }

        const isAddedToAnyPickup = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(message.member.id));

        if (isAddedToAnyPickup.length === 0) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are not added to any pickup, no expire set`));
        }

        const isInPickingStage = await PickupModel.isPlayerAddedToPendingPickup(BigInt(message.guild.id), BigInt(message.member.id), 'picking_manual');

        if (isInPickingStage) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are not allowed to use expire when added to a pickup in picking stage`));
        }

        const validTime = Util.validateTimeString(params.join(' '), defaults[0], (60 * 1000));

        if (validTime === 'exceeded') {
            return message.channel.send(Util.formatMessage('error', `${message.author}, max expire time is **${Util.formatTime(defaults[0])}**`));
        } else if (validTime === 'subceeded') {
            return message.channel.send(Util.formatMessage('error', `${message.author}, min expire time is **1 minute**`));
        } else if (validTime === 'invalid') {
            return message.channel.send(Util.formatMessage('error', `${message.author}, invalid time amounts given`));
        }

        await PlayerModel.setExpire(BigInt(message.guild.id), BigInt(message.member.id), validTime);
        message.channel.send(Util.formatMessage('success', `${message.author}, you will be removed from all pickups in **${Util.formatTime(validTime)}**`));
    }
}

module.exports = command;