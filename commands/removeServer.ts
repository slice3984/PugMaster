import { Command } from '../core/types';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'remove_server',
    category: 'admin',
    aliases: ['remove_sv'],
    shortDesc: 'Removes one or multiple servers',
    desc: 'Removes one or multiple servers',
    args: [
        { name: '<server>...', desc: 'The server to remove', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        let validServers = [];

        for (const server of params) {
            const isValid = await ServerModel.isServerStored(BigInt(message.guild.id), server);

            if (isValid) {
                validServers.push(server);
            }
        }

        if (!validServers.length) {
            return message.reply('given servers not found');
        }

        await ServerModel.removeServers(BigInt(message.guild.id), ...validServers);
        message.reply(`successfully removed server ${validServers.join(', ')}`);
    }
}

module.exports = command;