import { Command } from '../core/types';
import Util from '../core/util';
import { GuildMember } from 'discord.js';
import PlayerModel from '../models/player';
import PickupState from '../core/pickupState';

const command: Command = {
    cmd: 'ban',
    category: 'admin',
    shortDesc: 'Ban a player for a given time amount or permanent',
    desc: 'Ban a player for a given time amount or permanent',
    args: [
        { name: '<player>', desc: 'ping', required: true },
        { name: '<time/perm>', desc: 'Time given as 1m 2h 3d or permanent for bans without timelimit', required: true },
        { name: '[reason]', desc: 'Reason for the ban', required: false }
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
        const playerIdentifier = params[0];
        const time = params[1].toLowerCase();
        const player = await Util.getUser(message.guild, playerIdentifier, true);

        if (!player) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given player not found`));
        }

        if (player instanceof GuildMember) {
            PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(player.id), player.displayName);
        } else {
            PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(player.id), player.username);
        }

        if (['perm', 'permanent'].includes(time)) {
            const isBannedAlready = await PlayerModel.isPlayerBanned(BigInt(message.guild.id), BigInt(player.id));
            let msg = '';
            const reason = params.slice(2).join(' ');

            if (reason) {
                if (reason.length > 128) {
                    return message.channel.send(Util.formatMessage('error', `${message.author}, max reason length is 128 chars`));
                }
            }

            if (isBannedAlready) {
                // no date stored, perm ban
                if (!isBannedAlready.ends_at) {
                    return message.channel.send(Util.formatMessage('info', `${message.author}, **${isBannedAlready.player}** is already permbanned`));
                } else {
                    PlayerModel.unbanPlayer(BigInt(message.guild.id), +isBannedAlready.id);
                    const timeDif = isBannedAlready.ends_at.getTime() - new Date().getTime();

                    const issuer = defaults[0] === 'true' ? ', issuer: ' + `**${isBannedAlready.issuer}**` : '';
                    msg += `**${isBannedAlready.player}**'s old ban revoked. Time left: **${Util.formatTime(timeDif)}**${issuer}\n`;
                }
            }

            await PlayerModel.banPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), 0, false, params.slice(2).join(' ') || null);

            if (player instanceof GuildMember) {
                msg += `**${player.displayName}** got permanently banned ${params.slice(2).join(' ') ? 'Reason: ' + `**${params.slice(2).join(' ')}**` : ''}`;
            } else {
                msg += `**${player.username}** got permanently banned ${params.slice(2).join(' ') ? 'Reason: ' + `**${params.slice(2).join(' ')}**` : ''}`;
            }

            if (defaults[1] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        puChannel.send(Util.formatMessage('success', msg));
                    }
                }
            }
            await message.channel.send(Util.formatMessage('success', msg));
            await PickupState.removePlayer(message.guild.id, player.id);
        } else {
            const regex = /^\s*(?<time>(?:\d+[mhdw]\s+)*\d+[mhdw])\s*(?<reason>.*?)$/g;
            const merged = params.slice(1).join(' ');
            const match = regex.exec(merged);
            const timeStr = match ? match.groups.time : null;
            const reason = match ? match.groups.reason : null;

            if (!timeStr) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, invalid time amount given`));
            }

            const ms = Util.timeStringToTime(timeStr) * 60000;

            // 1h
            if (ms < (1000 * 60 * 60)) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, min ban time is **1 hour**`));
            }

            let msg = '';

            const isBannedAlready = await PlayerModel.isPlayerBanned(BigInt(message.guild.id), BigInt(player.id));

            if (isBannedAlready) {
                PlayerModel.unbanPlayer(BigInt(message.guild.id), +isBannedAlready.id);
                const issuer = defaults[0] === 'true' ? ', issuer: ' + `**${isBannedAlready.issuer}**` : '';

                // no date stored, perm ban
                if (!isBannedAlready.ends_at) {
                    msg += `**${isBannedAlready.player}**'s old ban revoked. Time left: **Permban**${issuer}\n`;
                } else {
                    const timeDif = isBannedAlready.ends_at.getTime() - new Date().getTime();
                    msg += `**${isBannedAlready.player}**'s old ban revoked. Time left: **${Util.formatTime(timeDif)}**${issuer}\n`;
                }
            }

            if (player instanceof GuildMember) {
                await PlayerModel.banPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), ms, false, reason || '');
                msg += `**${player.displayName}** got banned for **${Util.formatTime(ms)}**${reason ? ' - Reason: ' + `**${reason}**` : ''}`;
            } else {
                await PlayerModel.banPlayer(BigInt(message.guild.id), BigInt(message.member.id), BigInt(player.id), ms, false, reason || '');
                msg += `**${player.username}** got banned for **${Util.formatTime(ms)}**${reason ? ' - Reason: ' + `**${reason}**` : ''}`;
            }

            if (defaults[1] === 'true') {
                // Check if it got executed in the listen channel
                const isListenChannel = bot.getGuild(message.guild.id).channels.get(BigInt(message.channel.id)) === 'listen';
                if (isListenChannel) {
                    const puChannel = await Util.getPickupChannel(message.guild);
                    if (puChannel) {
                        puChannel.send(Util.formatMessage('success', msg));
                    }
                }
            }

            await message.channel.send(Util.formatMessage('success', msg));
            await PickupState.removePlayer(message.guild.id, player.id);
        }
    }
}

module.exports = command;