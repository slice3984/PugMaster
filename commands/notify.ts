import { Command } from '../core/types';
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
                return message.reply('invalid argument given, do you mean status?');
            }

            message.reply(`dm notifications for pickup starts are ${isEnabled ? 'enabled' : 'disabled'}`);
        } else {
            await PlayerModel.toggleNotify(BigInt(message.guild.id), BigInt(message.member.id));
            message.reply(`${isEnabled ? 'disabled' : 'enabled'} dm notifications for pickup starts`);
        }
    }
}

module.exports = command;