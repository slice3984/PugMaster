import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import { ApplicationCommandOptionData, ApplicationCommandOptionType, GuildMember, Snowflake } from 'discord.js';
import Bot from '../core/bot';

const command: Command = {
    cmd: 'promote',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to promote',
                    type: ApplicationCommandOptionType.String,
                    required: true,
                    choices: []
                }
            ];

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();
            const promotablePickups = enabledPickups.filter(pickup => pickup.gotPromotionRole);

            promotablePickups.forEach(pickup => {
                options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'pickup',
    shortDesc: 'Promote a pickup with set promotion role',
    desc: 'Promote a pickup with set promotion role',
    args: [
        { name: '<pickup>', desc: 'The pickup you want to promote', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const missingPermissions = Util.gotPermissions(message ? message : interaction, 'ManageRoles');

        if (missingPermissions) {
            if (interaction) {
                return interaction.reply({ embeds: [missingPermissions] });
            } else {
                return message.channel.send({ embeds: [missingPermissions] });
            }
        }

        const guild = interaction ? interaction.guild : message.guild;

        const guildSettings = bot.getGuild(guild.id);
        const timeUntilNextPromote = guildSettings.lastPromote ?
            (guildSettings.lastPromote.getTime() + guildSettings.promotionDelay) - new Date().getTime() : null;

        // Can be null if used for the first time
        if (timeUntilNextPromote && timeUntilNextPromote > 0) {
            return Util.send(message ? message : interaction, 'info', `you can't promote too often, please wait **${Util.formatTime(timeUntilNextPromote)}**`);
        }

        const pickup = params[0].toLowerCase();
        const isValidPickup = await PickupModel.areValidPickups(BigInt(guild.id), true, pickup);

        if (!isValidPickup.length) {
            return Util.send(message ? message : interaction, 'error', 'no valid pickup provided');
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), isValidPickup[0].id);
        const promotionRole = pickupSettings.promotionRole;

        if (!promotionRole) {
            return Util.send(message ? message : interaction, 'error', `No promotion role set for **${pickupSettings.name}**, not able to promote it`);
        }

        const role = guild.roles.cache.get(promotionRole.toString() as Snowflake);

        if (!role) {
            return Util.send(message ? message : interaction, 'error', `Stored promotion role for pickup **${pickupSettings.name}** not found`);
        }

        const activePickup = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id)))
            .values())
            .find(pu => pu.name === pickup);

        // Remove the promotion role to avoid unnecessary mentions
        const membersToAddRolesAgain: GuildMember[] = [];

        if (activePickup) {
            const players = activePickup.players;

            try {
                for (const player of players) {
                    const member = guild.members.cache.get(player.id.toString() as Snowflake);

                    if (member) {
                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            membersToAddRolesAgain.push(member);
                        }
                    }
                }
            } catch (_err) {
                return Util.send(message ? message : interaction, 'error', 'Can\'t remove the promotion role, are the required permissions given?', false);
            }
        }

        guildSettings.updateLastPromote();
        await GuildModel.updateLastPromote(BigInt(guild.id));

        const playersLeft = activePickup ? pickupSettings.playerCount - activePickup.players.length : pickupSettings.playerCount;
        Util.send(message ? message : interaction, null, `${role} please ${guildSettings.prefix}add to **${pickupSettings.name}**, **${playersLeft}** player${playersLeft > 1 ? 's' : ''} left!`, false);

        // Readd removed roles
        try {
            for (const member of membersToAddRolesAgain) {
                await member.roles.add(role);
            }
        } catch (_err) {
            return Util.send(message ? message : interaction, 'error', 'Can\'t readd removed roles, are the required permissions given?', false);
        }
    }
}

module.exports = command;