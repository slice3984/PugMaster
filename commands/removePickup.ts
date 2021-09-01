import { Command } from '../core/types';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import PickupState from '../core/pickupState';
import Util from '../core/util';
import { ButtonInteraction, GuildMember, MessageActionRow, MessageButton, MessageEmbed, Permissions } from 'discord.js';
import PermissionModel from '../models/permission';

const command: Command = {
    cmd: 'remove_pickups',
    category: 'admin',
    shortDesc: 'Remove one or multiple pickups',
    desc: 'Remove one or multiple pickups',
    args: [
        { name: '<pickup>...', desc: 'Pickup names', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const guildSettings = bot.getGuild(message.guild.id);

        if (guildSettings.activePrompts.has('remove_pickups')) {
            return message.channel.send(Util.formatMessage('error', `${message.author.toString()}, there is already a active prompt, wait until the prompt timed out or actions were made`));
        }

        const pickups = params.map(param => param.toLowerCase());

        let validPickups = await PickupModel.areValidPickups(BigInt(message.guild.id), false, ...pickups);

        if (!validPickups.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no valid pickups provided`));
        }

        const activePickups = Array.from(await (await (await PickupModel.getActivePickups(BigInt(message.guild.id))).values()));

        const filteredPickups = activePickups.filter(pickup => validPickups.map(pu => pu.id).includes(pickup.configId));

        // If the players is added at one of them as well, keep the state
        const untouchedPickups = activePickups.filter(pickup => !validPickups.map(pu => pu.id).includes(pickup.configId));

        let playersAddedTargetPickups = [];
        let playersAddedLeftPickups = [];

        untouchedPickups.forEach(pickup => {
            const players = pickup.players.map(player => player.id);
            playersAddedLeftPickups.push(...players);
        });

        filteredPickups.forEach(pickup => {
            const players = pickup.players.map(player => player.id);
            playersAddedTargetPickups.push(...players);
        });

        const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                    .setCustomId('confirm')
                    .setLabel('Delete pickups')
                    .setStyle('DANGER'),
                new MessageButton()
                    .setCustomId('Abort')
                    .setLabel('Abort')
                    .setStyle('SUCCESS')
            );

        const confirmationMessage = await message.channel.send({
            embeds: [
                new MessageEmbed()
                    .setTitle(`${Util.getBotEmoji('warn')} Pickup removal confirmation`)
                    .setColor('#ff0000')
                    .setDescription(
                        `You are about to remove the following pickups:\n` +
                        `${validPickups.map(p => `**${p.name}**`).join(', ')}\n\n` +
                        `- All pickup records will be deleted\n` +
                        `- All associated ratings will be deleted\n` +
                        `- All players added to this pickup will be removed\n\n` +
                        `**This action is irreversible, please confirm.**`
                    )
                    .setFooter('This prompt will be active for 30 seconds')
            ], components: [row]
        });

        const collector = confirmationMessage.createMessageComponentCollector({
            max: 1, time: 30000, filter:
                async (i: ButtonInteraction) => {
                    const member = i.member as GuildMember;
                    return member.id === message.author.id;
                }
        });

        guildSettings.activePrompts.add('remove_pickups');

        collector.on('collect', async (i: ButtonInteraction) => {
            // Recheck permissions, could be revoked by now
            const member = i.member as GuildMember;

            if (!member.permissions.has([Permissions.FLAGS.ADMINISTRATOR])) {
                const userRoleIds = member.roles.cache.map(strId => BigInt(strId.id));

                if (userRoleIds.length > 0) {
                    // Check if one of the user roles got the required permission
                    const gotPerms = await PermissionModel.guildRolesGotCommandPermission(BigInt(member.guild.id), 'remove_pickups', ...userRoleIds);

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
                // Remove pickups
                const playersToRemoveState = playersAddedTargetPickups.filter(playerId => !playersAddedLeftPickups.includes(playerId));

                if (playersToRemoveState.length) {
                    await GuildModel.resetPlayerStates(BigInt(message.guild.id), ...playersToRemoveState);
                }

                await PickupModel.removePickups(BigInt(message.guild.id), ...validPickups.map(pickup => pickup.id));

                // Update application commands
                await bot.updatePickupDependentApplicationCommands(message.guild);

                await message.channel.send(Util.formatMessage('success', `Removed **${validPickups.length}** pickup${validPickups.length > 1 ? 's' : ''} (${validPickups.map(pickup => `**${pickup.name}**`).join(' ')})`));

                if (filteredPickups.length) {
                    await PickupState.showPickupStatus(message.guild);
                }
            } else {
                await i.channel.send(Util.formatMessage('info', `${member.toString()}, pickup removal aborted`));
            }
        });

        collector.on('end', async (_, reason) => {
            guildSettings.activePrompts.delete('remove_pickups');

            if (reason === 'time') {
                await Util.send(message, 'info', 'pickup removal confirmation expired');
            }

            try {
                await confirmationMessage.delete();
            } catch (_) { }
        });
    }
}

module.exports = command;