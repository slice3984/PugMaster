import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'notify',
    category: 'pickup',
    shortDesc: 'DM notification on pickup start',
    desc: 'DM notification on pickup start',
    args: [
        { name: '[status]', desc: 'Call with status to see if it is currently enabled or disabled', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        await PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(message.member.id), message.member.displayName);
        const isEnabled = await PlayerModel.isNotifyEnabled(BigInt(message.guild.id), BigInt(message.member.id));

        if (params.length >= 1) {
            if (params[0].toLowerCase() !== 'status') {
                return message.channel.send(Util.formatMessage('error', `${message.author}, invalid argument given, do you mean **status**?`));
            }

            message.channel.send(Util.formatMessage('info', `${message.author}, your dm notifications for pickup starts are **${isEnabled ? 'enabled' : 'disabled'}**`));
        } else {
            await PlayerModel.toggleNotify(BigInt(message.guild.id), BigInt(message.member.id));
            message.channel.send(Util.formatMessage('success', `${message.author}, **${isEnabled ? 'disabled' : 'enabled'}** dm notifications for pickup starts`));
        }
    }
}

module.exports = command;