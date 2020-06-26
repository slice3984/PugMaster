import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';

const command: Command = {
    cmd: 'ao',
    shortDesc: 'Enables / disables or shows the status of your allow offline/afk',
    desc: 'Enables / disables or shows the status of your allow offline/afk, ao prevents removal on offline and afk status',
    args: [
        { name: '[show]', desc: 'call with show to show how much time is left until your ao expires', required: false }
    ],
    defaults: [
        { type: 'number', name: 'max-duration', desc: 'Duration of the allow offline/afk', value: 21600000, possibleValues: { from: 3600000, to: 86400000 } }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        if (params.length === 0) {
            const ao = await PlayerModel.getAos(BigInt(message.guild.id), message.member.id);

            if (!ao) {
                await PlayerModel.setAo(BigInt(message.guild.id), BigInt(message.member.id), defaults[0]);
                return message.reply(`ao enabled, you will have afk/offline immunity for ${Util.formatTime(defaults[0])}`);
            } else {
                await PlayerModel.removeAos(BigInt(message.guild.id), message.member.id);
                return message.reply('your ao got removed');
            }
        }

        if (params[0] === 'show') {
            const ao = await PlayerModel.getAos(BigInt(message.guild.id), message.member.id);

            if (!ao) {
                return message.reply('you got no active ao');
            }

            const timeLeft = ao[0].expiration_date.getTime() - new Date().getTime();
            message.reply(`your ao will expire in ${Util.formatTime(timeLeft)}`);
        }
    }
}

module.exports = command;