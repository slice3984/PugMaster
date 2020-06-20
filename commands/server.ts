import { Command } from '../core/types';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'server',
    shortDesc: 'Shows stored servers',
    desc: 'Shows stored servers',
    args: [
        { name: '[server]', desc: 'Display the given servers ip and password if set', required: false }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params) => {
        if (!params.length) {
            const servers = await ServerModel.getServers(BigInt(message.guild.id));

            if (!servers.length) {
                return message.reply('no servers stored');
            }

            message.reply(`server: ${servers.map(server => server.name).join(', ')}`);
        } else {
            const isServerStored = await ServerModel.isServerStored(BigInt(message.guild.id), params[0].toLowerCase());

            if (!isServerStored) {
                return message.reply('server not found');
            }

            const server = await ServerModel.getServer(BigInt(message.guild.id), params[0].toLowerCase());

            if (server.password) {
                message.reply(`name: ${server.name} ip: ${server.ip} password: ${server.password}`);
            } else {
                message.reply(`name: ${server.name} ip: ${server.ip}`);
            }
        }
    }
}

module.exports = command;