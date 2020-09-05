import Discord from 'discord.js';
import { Command } from '../core/types';
import StatsModel from '../models/stats';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'players',
    category: 'info',
    shortDesc: 'Shows players who played in the last x days, for a pickup or overall',
    desc: 'Shows players who played in the last x days, for a pickup or overall',
    args: [
        { name: '[pickup]', desc: 'Name of the pickup', required: false }
    ],
    defaults: [
        {
            type: 'number', name: 'period', desc: 'How long the latest pickup can be in the past for a player, given as days',
            value: 14, possibleValues: { from: 1, to: 30 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const limit = defaults[0];
        let pickup;
        let players: { id: bigint, amount: number }[];

        if (!params.length) {
            players = await StatsModel.getLastActive(BigInt(message.guild.id), 50, limit);

            if (!players.length) {
                return message.reply(`no pickups played in past ${defaults[0]} days`);
            }
        } else {
            pickup = params[0].toLowerCase();

            if (!await (await PickupModel.areValidPickups(BigInt(message.guild.id), pickup)).length) {
                return message.reply('unknown pickup provided');
            }

            players = await StatsModel.getLastActive(BigInt(message.guild.id), 50, limit, pickup);

            if (!players.length) {
                return message.reply(`no ${pickup} pickups played in past ${defaults[0]} days`);
            }
        }

        const online = [];
        const afk = [];
        const dnd = [];

        const addedPlayers = await GuildModel.getAllAddedPlayers(BigInt(message.guild.id));

        for (const player of players) {

            // Skip added players
            if (addedPlayers.includes(player.id.toString())) {
                continue;
            }

            const playerObj = await Util.getUser(message.guild, player.id.toString(), false) as Discord.GuildMember;

            if (playerObj) {
                switch (playerObj.presence.status) {
                    case 'online': online.push({ nick: playerObj.displayName, amount: player.amount }); break;
                    case 'idle': afk.push({ nick: playerObj.displayName, amount: player.amount }); break;
                    case 'dnd': dnd.push({ nick: playerObj.displayName, amount: player.amount }); break;
                }
            }
        }

        if (!online.length && !afk.length && !dnd.length) {
            return message.reply('no online pickup players found');
        }

        const formatArray = arr => arr.map(player => `\`${player.nick}\` (${player.amount})`);

        message.channel.send(
            `Online and not added${pickup ? ' ' + pickup : ''} pickup players (Added in last ${defaults[0]} days | Limit 50)\n` +
            (online.length ? `:green_circle: ${formatArray(online).join(' ')}\n` : '') +
            (afk.length ? `:orange_circle: ${formatArray(afk).join(' ')}\n` : '') +
            (dnd.length ? `:red_circle: ${formatArray(dnd).join(' ')}` : '')
        );
    }
}

module.exports = command;