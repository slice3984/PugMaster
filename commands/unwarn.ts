import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'unwarn',
    category: 'admin',
    shortDesc: 'Remove the last warn of a given player or all warns',
    desc: 'Remove the last warn of a given player or all warns',
    args: [
        { name: '<player/warnid>', desc: 'Warn id or player given as mention or id', required: true },
        { name: '[all]', desc: 'Call with all to remove all warnings', required: false }
    ],
    defaults: [
        {
            type: 'string', name: 'announce_in_pickup', desc: 'Show the message in the pickup channel as well if executed in the listen channel',
            value: 'true', possibleValues: ['true', 'false']
        }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params, defaults) => {
        const identifier = params[0];
        let nick = '';
        const player = await Util.getUser(message.guild, identifier);

        if (!player) {
            if (!/\d+/.test(identifier)) {
                return message.reply('invalid identifier, has to be mention, user id or ban id');
            }

            const isWarned = await PlayerModel.isPlayerWarned(BigInt(message.guild.id), +identifier);

            if (!isWarned) {
                return message.reply('warn id not found');
            }

            nick = isWarned;
        } else {
            const isWarned = await PlayerModel.isPlayerWarned(BigInt(message.guild.id), BigInt(player.id));

            if (!isWarned) {
                return message.reply('given player is not warned');
            }
            nick = isWarned;
        }

        const id = player ? BigInt(player.id) : +identifier;

        let msg = '';

        // Remove all warns
        if (params.length >= 2) {
            if (params[1] !== 'all') {
                return message.reply('invalid argument given, do you mean all?');
            }

            await PlayerModel.unwarnPlayer(BigInt(message.guild.id), id, true);
            msg = `revoked all warnings for ${nick}`;
        } else {
            await PlayerModel.unwarnPlayer(BigInt(message.guild.id), id, false);
            msg = `revoked ${nick}'s last warning`;
        }

        message.reply(msg);
        if (defaults[0] === 'true') {
            // Check if it got executed in the listen channel
            const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
            if (isListenChannel) {
                const puChannel = await Util.getPickupChannel(message.guild);
                if (puChannel) {
                    puChannel.send(msg);
                }
            }
        }
    }
}

module.exports = command;