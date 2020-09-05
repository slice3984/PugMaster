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
            type: 'number', name: 'max_expire', desc: 'Max expiration time in minutes',
            value: 1440, possibleValues: { from: 5, to: 2880 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        if (!params.length) {
            const expireDate = await PlayerModel.getExpires(BigInt(message.guild.id), BigInt(message.member.id));
            if (!expireDate) {
                return message.reply('no expire set');
            }

            const expiresIn = (expireDate[0].getTime() - new Date().getTime());
            return message.reply(`${Util.formatTime(expiresIn)} left until removal`);
        }

        if (params[0].toLowerCase() === 'none') {
            const expireDate = await PlayerModel.getExpires(BigInt(message.guild.id), BigInt(message.member.id));

            if (!expireDate) {
                return message.reply('you did not set any expire');
            }

            await PlayerModel.removeExpires(BigInt(message.guild.id), message.member.id);
            return message.reply('your expire got removed');
        }

        const isAddedToAnyPickup = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(message.member.id));

        if (isAddedToAnyPickup.length === 0) {
            return message.reply('you are not added to any pickup');
        }

        const validTime = Util.validateTimeString(params.join(' '), (defaults[0] * 60 * 1000), (60 * 1000));

        if (validTime === 'exceeded') {
            return message.reply(`max expire time is ${Util.formatTime(defaults[0] * 60000)}`);
        } else if (validTime === 'subceeded') {
            return message.reply(`min expire time is 1 minute`);
        } else if (validTime === 'invalid') {
            return message.reply('invalid time amounts given');
        }

        await PlayerModel.setExpire(BigInt(message.guild.id), BigInt(message.member.id), validTime);
        message.reply(`you will be removed from all pickups in ${Util.formatTime(validTime)}`);
    }
}

module.exports = command;