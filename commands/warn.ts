import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';
import { GuildMember } from 'discord.js';
import PickupState from '../core/pickupState';

const command: Command = {
    cmd: 'warn',
    category: 'admin',
    shortDesc: 'Warn a player',
    desc: 'Warn a player',
    args: [
        { name: '<player>', desc: 'ping', required: true },
        { name: '[reason]', desc: 'Reason for the ban', required: false }
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
        const guildSettings = bot.getGuild(message.guild.id);
        const playerIdentifier = params[0];
        const player = await Util.getUser(message.guild, playerIdentifier, false) as GuildMember;

        if (!player) {
            return message.reply(`given player not found`);
        }

        await PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(player.id), player.displayName);

        // Check if this warn is a ban
        const activeWarns = await PlayerModel.getActiveWarns(BigInt(message.guild.id), BigInt(player.id));

        if (guildSettings.warnsUntilBan <= activeWarns.length + 1) {
            const reason = params.slice(1).join(' ');

            if (reason) {
                if (reason.length > 128) {
                    return message.reply('max reason length is 128 chars');
                }
            }

            const guildSettings = bot.getGuild(message.guild.id);

            // Get current warn streak
            const warnsInStreak = await PlayerModel.getWarnsInStreak(BigInt(message.guild.id), BigInt(player.id));

            // Also add the current warn
            let currentStreak = Math.floor((warnsInStreak + 1) / guildSettings.warnsUntilBan);
            currentStreak = currentStreak > guildSettings.warnStreaks ? guildSettings.warnStreaks : currentStreak;

            // Don't count the first streak
            let banTime;

            if (currentStreak === 1) {
                banTime = guildSettings.warnBanTime;
            } else {
                banTime = guildSettings.warnBanTime * (guildSettings.warnBanTimeMultiplier * (currentStreak - 1));
            }

            const reasonParts = [];

            // Add previous reasons to the ban reason and shorten if required
            activeWarns.forEach(warn => {
                let reason = warn.reason;
                if (reason) {
                    if (reason.length > (45 / guildSettings.warnsUntilBan)) {
                        reasonParts.push(reason.substr(0, (45 / guildSettings.warnsUntilBan) - 2) + '..');
                    } else {
                        reasonParts.push(reason);
                    }
                }
            });

            if (reason) {
                reasonParts.push(reason);
            }

            const reasonToDisplay = reasonParts.join('/');

            await PlayerModel.warnPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), reason || null);
            await PlayerModel.setActiveWarnsToFalse(BigInt(message.guild.id), BigInt(player.id));
            await PlayerModel.unbanPlayer(BigInt(message.guild.id), BigInt(player.id));
            await PlayerModel.banPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), banTime, true, reasonToDisplay);

            const msg = `${player.displayName} got banned for ${Util.formatTime(banTime)}, ${guildSettings.warnsUntilBan}/${guildSettings.warnsUntilBan} warns (Streak ${currentStreak})`;

            if (defaults[0] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = guildSettings.channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        await puChannel.send(msg);
                    }
                }
            }

            await message.channel.send(msg);
            PickupState.removePlayer(BigInt(message.guild.id), BigInt(player.id));
        } else {
            const reason = params.slice(1).join(' ');

            if (reason) {
                if (reason.length > 128) {
                    return message.reply('max reason length is 128 chars');
                }
            }

            await PlayerModel.warnPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), reason);

            const msg = `${player.displayName} got warned${reason ? ' Reason: ' + reason : ''} (${activeWarns.length + 1}/${guildSettings.warnsUntilBan} warns)`;

            if (defaults[0] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        await puChannel.send(msg);
                    }
                }
            }

            return message.channel.send(msg);
        }
    }
}

module.exports = command;