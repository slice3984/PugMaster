import { Command } from '../core/types';
import Util from '../core/util';
import StatsModel from '../models/stats';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import { Snowflake } from 'discord.js';

const command: Command = {
    cmd: 'sub',
    applicationCommand: {
        global: true,
    },
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
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const guildSettings = bot.getGuild(guild.id);

        const timeUntilNextPromote = guildSettings.lastPromote ?
            (guildSettings.lastPromote.getTime() + guildSettings.promotionDelay) - new Date().getTime() : null;

        // Can be null if used for the first time
        if (timeUntilNextPromote && timeUntilNextPromote > 0) {
            return Util.send(message ? message : interaction, 'error', `you can't promote too often, please wait **${Util.formatTime(timeUntilNextPromote)}**`);
        }

        const lastGame = await StatsModel.getLastGame(BigInt(guild.id));

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), lastGame.name);

        let role;

        if (pickupSettings.promotionRole) {
            role = guild.roles.cache.get(pickupSettings.promotionRole.toString() as Snowflake);

            if (!role) {
                return Util.send(message ? message : interaction, 'error', `Stored promotion role for pickup **${lastGame.name}** not found`, false);
            }
        } else {
            return Util.send(message ? message : interaction, 'error', 'No promotion role set for this pickup, not able to call a sub', false);
        }

        const agoSince = new Date().getTime() - lastGame.startedAt.getTime();

        if (agoSince > defaults[0]) {
            return Util.send(message ? message : interaction, 'error', `can't call a sub for **${lastGame.name}**, pickup played too long ago`);
        }

        guildSettings.updateLastPromote();
        await GuildModel.updateLastPromote(BigInt(guild.id));

        const subMessage = await Util.parseNotifySubMessage(BigInt(guild.id), guildSettings.subMessage, pickupSettings);
        return Util.send(message ? message : interaction, 'warn', subMessage, null);
    }
}

module.exports = command;