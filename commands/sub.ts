import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import { Snowflake } from 'discord.js';

const command: Command = {
    cmd: 'sub',
    category: 'pickup',
    shortDesc: 'Call for a sub for the latest pickup',
    desc: 'Call for a sub for the latest pickup',
    defaults: [
        {
            type: 'time', name: 'timeout-after', desc: 'How long the command is callable after the latest pickup',
            value: 7200000, possibleValues: { from: 1800000, to: 21600000 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);

        const timeUntilNextPromote = guildSettings.lastPromote ?
            (guildSettings.lastPromote.getTime() + guildSettings.promotionDelay) - new Date().getTime() : null;

        // Can be null if used for the first time
        if (timeUntilNextPromote && timeUntilNextPromote > 0) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you can't promote too often, please wait **${Util.formatTime(timeUntilNextPromote)}**`));
        }

        const lastGame = await StatsModel.getLastGame(BigInt(message.guild.id));

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), lastGame.name);

        let role;

        if (pickupSettings.promotionRole) {
            role = message.guild.roles.cache.get(pickupSettings.promotionRole.toString() as Snowflake);

            if (!role) {
                return message.channel.send(Util.formatMessage('error', `Stored promotion role for pickup **${lastGame.name}** not found`));
            }
        } else {
            return message.channel.send(Util.formatMessage('error', 'No promotion role set for this pickup, not able to call a sub'));
        }

        const agoSince = new Date().getTime() - lastGame.startedAt.getTime();

        if (agoSince > defaults[0]) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, can't call a sub for **${lastGame.name}**, pickup played too long ago`));
        }

        guildSettings.updateLastPromote();
        await GuildModel.updateLastPromote(BigInt(message.guild.id));

        const subMessage = await Util.parseNotifySubMessage(BigInt(message.guild.id), guildSettings.subMessage, pickupSettings);
        message.channel.send(`${role}, ${subMessage}`);
    }
}

module.exports = command;