import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import { GuildMember } from 'discord.js';

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
            return message.reply(`you can't promote too often, please wait ${Util.formatTime(timeUntilNextPromote)}`);
        }

        const pickup = params[0].toLowerCase();
        const isValidPickup = await PickupModel.areValidPickups(BigInt(message.guild.id), pickup);

        if (!isValidPickup.length) {
            return message.reply('no valid pickup provided');
        }

        const promotionRole = await (await PickupModel.getPickupSettings(BigInt(message.guild.id), isValidPickup[0].id)).promotionRole;

        if (!promotionRole) {
            return message.reply('no promotion role for this pickup set, can\'t promote it');
        }

        const role = message.guild.roles.cache.get(promotionRole.toString());

        if (!role) {
            return message.channel.send(`set promotion role for pickup ${pickup} not found`);
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
                    const member = message.guild.members.cache.get(player.id.toString());

                    if (member) {
                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            membersToAddRolesAgain.push(member);
                        }
                    }
                }
            } catch (_err) {
                return message.channel.send('can\'t remove the promotion role, are the required permissions given?');
            }
        }

        guildSettings.updateLastPromote();
        await GuildModel.updateLastPromote(BigInt(message.guild.id));

        message.channel.send(`${role} please ${guildSettings.prefix}add to ${pickup}`);

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