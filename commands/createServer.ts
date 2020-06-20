import { Command } from '../core/types';
import { Validator } from '../core/validator';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'create_server',
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
            return message.reply(isValid.errorMessage);
        }

        const validIp = Validator.Server.isValidIp(ip);

        if (validIp !== true) {
            return message.reply(validIp.errorMessage);
        }

        if (params.length === 3) {
            const validPassword = Validator.Server.isValidPassword(params[2]);

            if (validPassword !== true) {
                return message.reply(validPassword.errorMessage);
            }

            await ServerModel.addServer(BigInt(message.guild.id), name, ip, params[2]);
        } else {
            await ServerModel.addServer(BigInt(message.guild.id), name, ip);
        }

        message.reply(`successfully created new server ${name}`);
    }
}

module.exports = command;