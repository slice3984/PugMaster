import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'unban',
    category: 'admin',
    shortDesc: 'Unban players',
    desc: 'Unban players',
    args: [
        { name: '<player/banid>', desc: 'Ban id or player given as mention or id', required: true }
    ],
    defaults: [
        {
            type: 'string', name: 'show_issuer', desc: 'Display issuers as well in unbans',
            value: 'true', possibleValues: ['true', 'false']
        },
        {
            type: 'string', name: 'announce_in_pickup', desc: 'Show the message in the pickup channel as well if executed in the listen channel',
            value: 'true', possibleValues: ['true', 'false']
        }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params, defaults) => {
        const identifier = params[0];

        // Try userid, mention first
        const player = await Util.getUser(message.guild, identifier, false);

        if (!player) {
            // Try banid
            if (!/\d+/.test(identifier)) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, invalid identifier, has to be **mention**, **user id** or **ban id**`));
            }

            const isBanned = await PlayerModel.isPlayerBanned(BigInt(message.guild.id), +identifier);

            if (!isBanned) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, ban id not found`));
            }

            await PlayerModel.unbanPlayer(BigInt(message.guild.id), +isBanned.id);

            const issuer = defaults[0] === 'true' ? ', issuer: ' + `**${isBanned.issuer}**` : '';

            if (defaults[1] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        puChannel.send(Util.formatMessage('success', `Revoked **${isBanned.player}'s** ban${issuer}`));
                    }
                }
            }
            return message.reply(`revoked ${isBanned.player}'s ban${issuer}`);
        } else {
            const isBanned = await PlayerModel.isPlayerBanned(BigInt(message.guild.id), BigInt(player.id));

            if (!isBanned) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, given player is not banned`));
            }

            await PlayerModel.unbanPlayer(BigInt(message.guild.id), +isBanned.id);

            const issuer = defaults[0] === 'true' ? ', issuer: ' + `**${isBanned.issuer}**` : '';

            if (defaults[1] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        puChannel.send(Util.formatMessage('success', `Revoked **${isBanned.player}'s** ban${issuer}`));
                    }
                }
            }

            message.channel.send(Util.formatMessage('success', `Revoked **${isBanned.player}'s** ban${issuer}`));
        }
    }
}

module.exports = command;