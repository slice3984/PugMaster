import { Command } from '../core/types';
import Util from '../core/util';
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
        let guildServer;
        const guildSettings = bot.getGuild(message.guild.id);
        const validServers = await ServerModel.isServerStored(BigInt(message.guild.id), ...params);


        if (!validServers.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given servers not found`));
        }

        await ServerModel.removeServers(BigInt(message.guild.id), ...validServers.map(server => server.name));

        if (guildSettings.defaultServer) {
            guildServer = validServers.find(server => server.id === guildSettings.defaultServer);

            if (guildServer) {
                bot.getGuild(message.guild.id).disableServer();
            }
        }

        message.channel.send(Util.formatMessage('success', `Removed server ${validServers.map(server => `**${server.name}**`).join(', ')}` +
            (guildServer ? `\nCleared default server **${guildServer.name}**` : '')));
    }
}

module.exports = command;