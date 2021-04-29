import { Command } from '../core/types';
import Util from '../core/util';
import { Validator } from '../core/validator';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'create_server',
    category: 'admin',
    aliases: ['create_sv'],
    shortDesc: 'Creates a server which can be assigned to pickups',
    desc: 'Creates a server which can be assigned to pickups',
    args: [
        { name: '<name>', desc: 'Name of the server', required: true },
        { name: '<ip>', desc: 'IP of the server', required: true },
        { name: '[password]', desc: 'Password of the server', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const name = params[0].toLowerCase();
        const ip = params[1];

        const isValid = await Validator.Server.isValidServer(BigInt(message.guild.id), name, false);

        if (isValid !== true) {
            return message.channel.send(Util.formatMessage('error', isValid.errorMessage));
        }

        const validIp = Validator.Server.isValidIp(ip);

        if (validIp !== true) {
            return message.channel.send(Util.formatMessage('error', validIp.errorMessage));
        }

        if (params.length === 3) {
            const validPassword = Validator.Server.isValidPassword(params[2]);

            if (validPassword !== true) {
                return message.channel.send(Util.formatMessage('error', validPassword.errorMessage));
            }

            await ServerModel.addServer(BigInt(message.guild.id), name, ip, params[2]);
        } else {
            await ServerModel.addServer(BigInt(message.guild.id), name, ip);
        }

        message.channel.send(Util.formatMessage('success', `Created server **${name}**`));
    }
}

module.exports = command;