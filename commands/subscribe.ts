import { ApplicationCommandOptionData, GuildMember, Snowflake } from 'discord.js';
import Bot from '../core/bot';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'subscribe',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to subscribe to',
                    type: 'STRING',
                    required: true,
                    choices: []
                }
            ]

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
    shortDesc: 'Subscribe to one or multiple pickus to get notified on promotions',
    desc: 'Subscribe to one or multiple pickus to get notified on promotions',
    args: [
        { name: '<pickup>...', desc: 'The pickups you want to subscribe to', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const missingPermissions = Util.gotPermissions(message ? message : interaction, 'MANAGE_ROLES');

        if (missingPermissions) {
            if (interaction) {
                return interaction.reply({ embeds: [missingPermissions] });
            } else {
                return message.channel.send({ embeds: [missingPermissions] });
            }
        }

        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        let validPickups = await PickupModel.areValidPickups(BigInt(guild.id), true, ...params);

        if (!validPickups.length) {
            return Util.send(message ? message : interaction, 'error', 'no valid pickups provided');
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToSubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToSubscribe.length) {
            return Util.send(message ? message : interaction, 'warn', 'given valid pickups got no promotion role');
        }

        const userRoleIds = member.roles.cache.map(role => role.id);

        pickupsToSubscribe = pickupsToSubscribe.filter(pickup => !userRoleIds.includes(pickup.promotionRole as Snowflake));

        if (!pickupsToSubscribe.length) {
            if (interaction) {
                return Util.send(interaction, 'error', 'you are already subscribed to this pickup');
            } else {
                return message.channel.send(Util.formatMessage('error', `${message.author}, you are already subscribed to the given valid pickups`));
            }
        }

        pickupsToSubscribe.filter(pickup => {
            if (guild.roles.cache.get(pickup.promotionRole.toString() as Snowflake)) {
                return true;
            } else {
                return false;
            }
        });

        if (!pickupsToSubscribe.length) {
            return Util.send(message ? message : interaction, 'error', 'Stored promotion roles for provided valid pickups not found', false);
        }

        try {
            await member.roles.add(pickupsToSubscribe.map(pickup => pickup.promotionRole.toString() as Snowflake))
        } catch (_err) {
            return Util.send(message ? message : interaction, 'error', 'Not able to set one or multiple roles, are the required permission given, do the roles exist?', false);
        }

        Util.send(message ? message : interaction, 'success', `subscribed to ${pickupsToSubscribe.map(pickup => `**${pickup.name}**`).join(', ')}`);
    }
}

module.exports = command;