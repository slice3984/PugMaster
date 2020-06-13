import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'expire',
    shortDesc: 'Set or show the amount of time after you get removed from all pickups',
    desc: 'Set or show the amount of time after you get removed from all pickups',
    args: [
        { name: '[time]...', desc: 'time-short', required: false }
    ],
    defaults: [
        {
            type: 'number', desc: 'Max expiration time',
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

        if (!/^(\d+[mhd]\s*)+$/m.test(params.join(' '))) {
            return message.reply('invalid time amounts given');
        }

        // Fast check to see if the entered number is too high
        for (const param of params) {
            if ((param.length - 1) > defaults[0].toString().length) {
                return message.reply(`max expire time is ${Util.formatTime(defaults[0] * 60000)}`);
            }
        }

        const time = Util.timeStringToTime(params.join(' '));

        if (time > defaults[0]) {
            return message.reply(`max expire time is ${Util.formatTime(defaults[0] * 60000)}`);
        }

        await PlayerModel.setExpire(BigInt(message.guild.id), BigInt(message.member.id), time);
        message.reply(`you will be removed from all pickups in ${Util.formatTime(time * 60000)}`);
    }
}

module.exports = command;