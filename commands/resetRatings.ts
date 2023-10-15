import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, GuildMember, PermissionFlagsBits } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PermissionModel from '../models/permission';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'reset_ratings',
    cooldown: 10,
    category: 'admin',
    shortDesc: 'Clear the ratings for given pickups',
    desc: 'Clear the ratings for given pickups',
    args: [
        { name: '<pickup>...', desc: 'Pickup names', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const guildSettings = bot.getGuild(message.guild.id);

        if (guildSettings.activePrompts.has('reset_ratings')) {
            return Util.send(message, 'error', 'there is already a active prompt, wait until the prompt timed out or actions were made');
        }

        const pickups = params.map(param => param.toLowerCase());

        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), false, ...pickups);

        if (!validPickups.length) {
            return Util.send(message, 'error', 'no valid pickups provided');
        }

        const row = new ActionRowBuilder<any>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Reset ratings')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('Abort')
                    .setLabel('Abort')
                    .setStyle(ButtonStyle.Success)
            );

        const confirmationMessage = await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`${Util.getBotEmoji('warn')} Rating reset confirmation`)
                    .setColor('#ff0000')
                    .setDescription(
                        `You are about to reset the ratings of the following pickups:\n` +
                        `${validPickups.map(p => `**${p.name}**`).join(', ')}\n\n` +
                        `- All associated ratings will be deleted\n\n` +
                        `**This action is irreversible, please confirm.**`
                    )
                    .setFooter({ text: 'This prompt will be active for 30 seconds' })
            ], components: [row]
        });

        const collector = confirmationMessage.createMessageComponentCollector({
            max: 1, time: 30000, filter:
                async i => {
                    const member = i.member as GuildMember;
                    return member.id === message.author.id;
                }
        });

        guildSettings.activePrompts.add('reset_ratings');

        collector.on('collect', async (i: ButtonInteraction) => {
            // Recheck permissions, could be revoked by now
            const member = i.member as GuildMember;

            if (!member.permissions.has([PermissionFlagsBits.Administrator])) {
                const userRoleIds = member.roles.cache.map(strId => BigInt(strId.id));

                if (userRoleIds.length > 0) {
                    // Check if one of the user roles got the required permission
                    const gotPerms = await PermissionModel.guildRolesGotCommandPermission(BigInt(member.guild.id), 'reset_ratings', ...userRoleIds);

                    if (!gotPerms) {
                        try {
                            await confirmationMessage.delete();
                            await i.channel.send(Util.formatMessage('error', `${member.toString()}, insufficient permissions, aborted.`));
                        } catch (_) { }
                        return;
                    }
                }
            }

            if (i.customId === 'confirm') {
                // Reset ratings
                await GuildModel.resetRatings(BigInt(message.guild.id), ...validPickups.map(pickup => pickup.id));
                await Util.send(message, 'success', `Ratings cleared for pickup: ${validPickups.map(pickup => `**${pickup.name}**`).join(', ')}`)
            } else {
                await i.channel.send(Util.formatMessage('info', `${member.toString()}, rating reset aborted`));
            }
        });

        collector.on('end', async (_, reason) => {
            guildSettings.activePrompts.delete('reset_ratings');

            if (reason === 'time') {
                await Util.send(message, 'info', 'rating reset removal confirmation expired');
            }

            try {
                await confirmationMessage.delete();
            } catch (_) { }
        });
    }
}

module.exports = command;