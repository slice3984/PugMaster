import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import { GuildMember, Snowflake } from 'discord.js';

const command: Command = {
    cmd: 'promote',
    category: 'pickup',
    shortDesc: 'Promote a pickup with set promotion role',
    desc: 'Promote a pickup with set promotion role',
    args: [
        { name: '<pickup>', desc: 'The pickup you want to promote', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        const guildSettings = bot.getGuild(message.guild.id);
        const timeUntilNextPromote = guildSettings.lastPromote ?
            (guildSettings.lastPromote.getTime() + guildSettings.promotionDelay) - new Date().getTime() : null;

        // Can be null if used for the first time
        if (timeUntilNextPromote && timeUntilNextPromote > 0) {
            return message.channel.send(Util.formatMessage('info', `${message.author}, you can't promote too often, please wait **${Util.formatTime(timeUntilNextPromote)}**`));
        }

        const pickup = params[0].toLowerCase();
        const isValidPickup = await PickupModel.areValidPickups(BigInt(message.guild.id), true, pickup);

        if (!isValidPickup.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no valid pickup provided`));
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), isValidPickup[0].id);
        const promotionRole = pickupSettings.promotionRole;

        if (!promotionRole) {
            return message.channel.send(Util.formatMessage('error', `No promotion role set for **${pickupSettings.name}**, not able to promote it`));
        }

        const role = message.guild.roles.cache.get(promotionRole.toString() as Snowflake);

        if (!role) {
            return message.channel.send(Util.formatMessage('error', `Stored promotion role for pickup **${pickupSettings.name}** not found`));
        }

        const activePickup = Array.from(await (await PickupModel.getActivePickups(BigInt(message.guild.id)))
            .values())
            .find(pu => pu.name === pickup);

        // Remove the promotion role to avoid unnecessary mentions
        const membersToAddRolesAgain: GuildMember[] = [];

        if (activePickup) {
            const players = activePickup.players;

            try {
                for (const player of players) {
                    const member = message.guild.members.cache.get(player.id.toString() as Snowflake);

                    if (member) {
                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            membersToAddRolesAgain.push(member);
                        }
                    }
                }
            } catch (_err) {
                return message.channel.send(Util.formatMessage('error', 'Can\'t remove the promotion role, are the required permissions given?'));
            }
        }

        guildSettings.updateLastPromote();
        await GuildModel.updateLastPromote(BigInt(message.guild.id));

        const playersLeft = activePickup ? pickupSettings.playerCount - activePickup.players.length : pickupSettings.playerCount;
        message.channel.send(`${role} please ${guildSettings.prefix}add to **${pickupSettings.name}**, **${playersLeft}** player${playersLeft > 1 ? 's' : ''} left!`);

        // Readd removed roles
        try {
            for (const member of membersToAddRolesAgain) {
                await member.roles.add(role);
            }
        } catch (_err) {
            message.channel.send('Can\'t readd removed roles, are the required permissions given?');
        }
    }
}

module.exports = command;