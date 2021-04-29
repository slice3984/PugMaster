import { Command } from '../core/types';
import ServerModel from '../models/server';
import { Validator } from '../core/validator';
import Util from '../core/util';

const command: Command = {
    cmd: 'modify_server',
    category: 'admin',
    aliases: ['modify_sv'],
    shortDesc: 'Change the ip or password of a stored server',
    desc: 'Change the ip or password of a stored server',
    args: [
        { name: '<name>', desc: 'Name of the server', required: true },
        { name: '<ip/password>', desc: 'Which part to modify, ip or password', required: true },
        { name: '<value>', desc: 'The new value for the ip or password', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const name = params[0].toLowerCase();
        const field = params[1].toLowerCase();
        const value = params[2];

        const isValid = await Validator.Server.isValidServer(BigInt(message.guild.id), name);

        if (isValid !== true) {
            return message.reply(isValid.errorMessage);
        }

        if (!['ip', 'password'].includes(field)) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, invalid property, has to be **ip** or **password**`));
        }

        const server = await ServerModel.getServer(BigInt(message.guild.id), name);

        if (field === 'ip') {
            const validIp = Validator.Server.isValidIp(field);
            if (validIp !== true) {
                return message.channel.send(Util.formatMessage('error', validIp.errorMessage));
            }

            if (value === server.ip) {
                return message.channel.send(Util.formatMessage('error', `IP for server **${name}** is already set to **${value}**`));
            }
        } else {
            const validPassword = Validator.Server.isValidPassword(field);

            if (validPassword !== true) {
                return message.channel.send(Util.formatMessage('error', validPassword.errorMessage));
            }

            if (server.password && server.password === value) {
                return message.channel.send(Util.formatMessage('error', `Password for server **${name}** is already set to **${value}**`));
            }
        }

        await ServerModel.modifyServer(BigInt(message.guild.id), name, field, value);
        message.channel.send(Util.formatMessage('success', `Modified server **${name}**, set **${field}** to **${value}**`));
    }
}

module.exports = command;