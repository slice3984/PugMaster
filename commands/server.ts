import { Command } from '../core/types';
import Util from '../core/util';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'server',
    category: 'info',
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
                return message.channel.send(Util.formatMessage('info', 'No servers stored'));
            }

            message.channel.send(Util.formatMessage('info', `Server: ${servers.map(server => `**${server.name}**`).join(', ')}`));
        } else {
            const isServerStored = await ServerModel.isServerStored(BigInt(message.guild.id), params[0].toLowerCase());

            if (!isServerStored) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, server not found`));
            }

            const server = await ServerModel.getServer(BigInt(message.guild.id), params[0].toLowerCase());

            if (server.password) {
                message.channel.send(Util.formatMessage('info', `Name: **${server.name}** IP: **${server.ip}** Password: **${server.password}**`));
            } else {
                message.channel.send(Util.formatMessage('info', `Name: **${server.name}** IP: **${server.ip}**`));
            }
        }
    }
}

module.exports = command;