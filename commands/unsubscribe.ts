import { ApplicationCommandOptionData, GuildMember, Snowflake } from 'discord.js';
import Bot from '../core/bot';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'unsubscribe',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to unsubscribe from',
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
    shortDesc: 'Unsubscribe from one or multiple pickups',
    desc: 'Unsubscribe from one or multiple pickups',
    args: [
        { name: '<pickup>...', desc: 'The pickups you want to unsubscribe from', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        let validPickups = await PickupModel.areValidPickups(BigInt(guild.id), true, ...params);

        if (!validPickups.length) {
            return Util.send(message ? message : interaction, 'error', 'no valid pickups provided');
        }

        const pickupIds = validPickups.map(pickup => pickup.id);
        let pickupsToUnsubscribe = await (await PickupModel.getMultiplePickupSettings(BigInt(guild.id), ...pickupIds))
            .filter(pickup => pickup.promotionRole);

        if (!pickupsToUnsubscribe.length) {
            return Util.send(message ? message : interaction, 'warn', 'given valid pickups got no promotion role');
        }

        const userRoleIds = member.roles.cache.map(role => role.id);

        pickupsToUnsubscribe = pickupsToUnsubscribe.filter(pickup => userRoleIds.includes(pickup.promotionRole as Snowflake));

        if (!pickupsToUnsubscribe.length) {
            return Util.send(interaction, 'error', 'you are already not subscribed to the given valid pickups');
        }

        try {
            await member.roles.remove(pickupsToUnsubscribe.map(pickup => pickup.promotionRole.toString() as Snowflake));
        } catch (_err) {
            return Util.send(message ? message : interaction, 'error', 'Not able to remove one or multiple roles, are the required permission given, do the roles exist?', false);
        }

        Util.send(message ? message : interaction, 'success', `unsubscribed from ${pickupsToUnsubscribe.map(pickup => `**${pickup.name}**`).join(', ')}`);

    }
}

module.exports = command;