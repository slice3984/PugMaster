import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import Bot from '../core/bot';
import { GuildMember } from 'discord.js';

const command: Command = {
    cmd: 'expire',
    category: 'pickup',
    applicationCommand: {
        global: false,
        getOptions: (guild) => {
            const bot = Bot.getInstance();
            let defaultMaxExpire = command.defaults[0].value as number;
            const customMaxExpire = bot.getGuild(guild.id).commandSettings.get('expire');

            // In minutes
            const maxExpireTime = customMaxExpire ? customMaxExpire / 1000 / 60 : defaultMaxExpire / 1000 / 60;

            const choices = [{ name: 'Clear expire', value: 'none' }];

            const expireTimes = [
                { minutes: 5, value: '5m', desc: '5 minutes' },
                { minutes: 10, value: '10m', desc: '10 minutes' },
                { minutes: 15, value: '15m', desc: '15 minutes' },
                { minutes: 30, value: '30m', desc: '30 minutes' },
                { minutes: 60, value: '1h', desc: '1 hour' },
                { minutes: 120, value: '2h', desc: '2 hours' },
                { minutes: 360, value: '6h', desc: '6 hours' },
            ];

            for (let i = 0; i < expireTimes.length; i++) {
                const time = expireTimes[i];

                if (time.minutes > maxExpireTime) {
                    break;
                }

                choices.push({
                    name: time.desc,
                    value: time.value
                });
            }

            return [
                {
                    name: 'time',
                    description: 'Time until you get removed from all pickups',
                    type: 'STRING',
                    choices
                }
            ]
        }
    },
    shortDesc: 'Set, remove or show the amount of time after you get removed from all pickups',
    desc: 'Set, remove or show the amount of time after you get removed from all pickups',
    args: [
        { name: '[time]...', desc: 'time-short', required: false }
    ],
    defaults: [
        {
            type: 'time', name: 'max_expire', desc: 'Max expiration time',
            value: 86400000, possibleValues: { from: 300000, to: 172800000 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        if (!params.length) {
            const expireDate = await PlayerModel.getExpires(BigInt(guild.id), BigInt(member.id));
            if (!expireDate) {
                return Util.send(message ? message : interaction, 'info', 'no expire set');
            }

            const expiresIn = (expireDate[0].getTime() - new Date().getTime());
            return Util.send(message ? message : interaction, 'info', `**${Util.formatTime(expiresIn)}** left until removal`);
        }

        if (params[0].toLowerCase() === 'none') {
            const expireDate = await PlayerModel.getExpires(BigInt(guild.id), BigInt(member.id));

            if (!expireDate) {
                return Util.send(message ? message : interaction, 'error', 'you did not set any expire');
            }

            await PlayerModel.removeExpires(BigInt(guild.id), member.id);
            return Util.send(message ? message : interaction, 'success', 'your expire got removed');

        }

        const isAddedToAnyPickup = await PickupModel.isPlayerAdded(BigInt(guild.id), BigInt(member.id));

        if (isAddedToAnyPickup.length === 0) {
            return Util.send(message ? message : interaction, 'error', 'you are not added to any pickup, no expire set');
        }

        const isInPickingStage = await PickupModel.isPlayerAddedToPendingPickup(BigInt(guild.id), BigInt(member.id), 'picking_manual', 'mapvote');

        if (isInPickingStage) {
            return Util.send(message ? message : interaction, 'error', 'you are not allowed to use expire when added to a pickup in picking or map vote stage');
        }

        const validTime = Util.validateTimeString(params.join(' '), defaults[0], (60 * 1000));

        if (validTime === 'exceeded') {
            return Util.send(message ? message : interaction, 'error', `max expire time is **${Util.formatTime(defaults[0])}**`);
        } else if (validTime === 'subceeded') {
            return Util.send(message ? message : interaction, 'error', 'min expire time is **1 minute**');
        } else if (validTime === 'invalid') {
            return Util.send(message ? message : interaction, 'error', 'invalid time amounts given');
        }

        await PlayerModel.setExpire(BigInt(guild.id), BigInt(member.id), validTime);
        return Util.send(message ? message : interaction, 'success', `you will be removed from all pickups in **${Util.formatTime(validTime)}**`);
    }
}

module.exports = command;