import Discord from 'discord.js';
import { Command } from '../core/types';
import { Validator } from '../core/validator';
import PickupModel from '../models/pickup';
import Util from '../core/util';
import MappoolModel from '../models/mappool';
import ServerModel from '../models/server';
import ConfigTool from '../core/configTool';


const command: Command = {
    cmd: 'modify_pickup',
    category: 'admin',
    aliases: ['modify_pu'],
    shortDesc: 'Modify or show the settings of a pickup',
    desc: 'Modify or show the settings of a pickup',
    args: [
        { name: '<pickup/list>', desc: 'pickup name or list to display all pickups including disabled ones', required: true },
        { name: '<key/show>', desc: 'Setting to change or show to display the current configuration', required: false },
        { name: '[value/none]', desc: 'Value of the change, none to disable', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const pickupOrOperation = params[0].toLowerCase();
        let key;

        if (pickupOrOperation === 'list' && params.length === 1) {
            const pickups = await PickupModel.getAllPickups(BigInt(message.guild.id), true);
            const enabledPickups = pickups.filter(p => p.enabled);
            const disabledPickups = pickups.filter(p => !p.enabled);

            const pickupsCardEmbed = new Discord.EmbedBuilder()
                .setColor('#126e82')
                .setTitle('Enabled and disabled server pickups')
                .addFields(
                    { name: 'Enabled', value: enabledPickups.length ? enabledPickups.map(p => `**${p.name}**`).join(', ') : 'No enabled pickups', inline: false },
                    { name: 'Disabled', value: disabledPickups.length ? disabledPickups.map(p => `**${p.name}**`).join(', ') : 'No disabled pickups', inline: false }
                );
            message.channel.send({ embeds: [pickupsCardEmbed] });
            return;
        } else if (params.length >= 2) {
            key = params[1].toLowerCase();
        } else {
            return Util.send(message, 'error', 'invalid argument given, do you mean **list**?')
        }

        if (params.length > 2) {
            const value = params[2];

            const dbColumnNames = ['is_enabled', 'player_count', 'team_count', 'is_default_pickup', 'is_rated', 'afk_check', 'pick_mode', 'allowlist_role',
                'denylist_role', 'promotion_role', 'captain_role', 'server_id', 'mappool_id', 'map_vote', 'server_id'];
            const keyNames = ['enabled', 'players', 'teams', 'default', 'rated', 'afkcheck', 'pickmode', 'allowlist', 'denylist', 'promotion', 'captain', 'server', 'mappool', 'mapvote', 'server'];
            let dbColumn = keyNames.includes(key) ? dbColumnNames[keyNames.indexOf(key)] : key;

            const keyisValid = Validator.Pickup.areValidKeys(key);

            if (keyisValid.length) {
                return Util.send(message, 'error', `Unknown property **${key}**`, false);
            }

            const isValidPickup = await PickupModel.areValidPickups(BigInt(message.guild.id), false, pickupOrOperation);

            if (!isValidPickup.length) {
                return Util.send(message, 'error', 'unknown pickup provided');
            }

            // Clear value if possible
            if (value === 'none') {
                if (['name', 'enabled', 'players', 'teams', 'default', 'rated', 'afkcheck', 'mapvote', 'pickmode', 'captain_selection'].includes(key)) {
                    return Util.send(message, 'error', `Property **${key}** can't be disabled`, false);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, null);

                if (key === 'mappool') {
                    // Attempt to disable in case its enabled
                    await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, 'map_vote', 'false');
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, null);

                if (key === 'promotion') {
                    await bot.getGuild(message.guild.id).updateEnabledPickups();
                    await bot.updateGuildApplicationCommand('promote', message.guild);
                    await bot.updateGuildApplicationCommand('subscribe', message.guild);
                    await bot.updateGuildApplicationCommand('unsubscribe', message.guild);
                }

                return Util.send(message, 'success', `Disabled property **${key}** for pickup **${pickupOrOperation}**, using server default if set`, false);
            }

            const error = await Validator.Pickup.validate(message.guild, pickupOrOperation, { key, value });

            if (error.length) {
                return Util.send(message, 'error', error[0].errorMessage, false);
            }

            const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickupOrOperation);
            const currentValue = pickupSettings[dbColumn];

            // Get role names for the given role string
            if (['allowlist', 'denylist', 'promotion', 'captain'].includes(key)) {
                const newRole = Util.getRole(message.guild, value);
                const oldRole = currentValue ? Util.getRole(message.guild, currentValue) : null;

                if (oldRole && oldRole.id === newRole.id) {
                    return Util.send(message, 'info', `Property **${key}** is already set to **${oldRole.name}** for pickup **${pickupOrOperation}**`, false);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, newRole.id);

                if (key === 'promotion') {
                    await bot.getGuild(message.guild.id).updateEnabledPickups();
                    await bot.updateGuildApplicationCommand('promote', message.guild);
                    await bot.updateGuildApplicationCommand('subscribe', message.guild);
                    await bot.updateGuildApplicationCommand('unsubscribe', message.guild);
                }

                Util.send(message, 'success', `Updated pickup **${pickupOrOperation}**, set **${key}** to **${newRole.name}**`, false);
            } else if (key === 'mappool') {
                const poolId = await (await MappoolModel.getPools(BigInt(message.guild.id), value))[0].id;

                if (currentValue && currentValue === poolId) {
                    return Util.send(message, 'info', `Map pool is already set to **${value}** for pickup **${pickupOrOperation}**`, false);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, poolId);
                Util.send(message, 'success', `Updated pickup **${pickupOrOperation}**, set map pool to **${value}**`, false);
            } else if (key === 'server') {
                const serverId = await ServerModel.getServerIds(BigInt(message.guild.id), value);

                if (currentValue && currentValue === serverId[0]) {
                    return Util.send(message, 'info', `Server is already set to **${value}** for pickup **${pickupOrOperation}**`, false);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, serverId[0]);
                Util.send(message, 'success', `Updated pickup **${pickupOrOperation}**, set server to **${value}**`, false);
            } else {
                if (currentValue && currentValue.toString() === value) {
                    return Util.send(message, 'info', `Property **${key}** is already set to **${value}** for pickup **${pickupOrOperation}**`, false);

                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickupOrOperation, dbColumn, value);

                if (key === 'enabled') {
                    // Update application commands
                    await bot.updatePickupDependentApplicationCommands(message.guild);
                }

                if (key === 'rated') {
                    await bot.getGuild(message.guild.id).updateEnabledPickups();
                    await bot.updateGuildApplicationCommand('leaderboard', message.guild);
                }

                Util.send(message, 'success', `Updated pickup **${pickupOrOperation}**, set **${key}** to **${value}**`, false);
            }
        } else {
            if (key !== 'show') {
                return Util.send(message, 'error', 'invalid argument given, do you mean **show**?');
            }

            const isValidPickup = await Validator.Pickup.isValidPickup(BigInt(message.guild.id), pickupOrOperation);

            if (!isValidPickup) {
                return Util.send(message, 'error', `pickup **${pickupOrOperation}** not found`);
            }

            const config = ConfigTool.getConfig();

            const settings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickupOrOperation);

            const mapPoolName = settings.mapPoolId ? await MappoolModel.getPoolName(BigInt(message.guild.id), settings.mapPoolId) : '-';
            const serverName = settings.serverId ? await (await ServerModel.getServer(BigInt(message.guild.id), settings.serverId)).name : '-';
            const allowlistRole = settings.allowlistRole ? Util.getRole(message.guild, settings.allowlistRole.toString()) : null;
            const denylistRole = settings.denylistRole ? Util.getRole(message.guild, settings.denylistRole.toString()) : null;
            const promotionRole = settings.promotionRole ? Util.getRole(message.guild, settings.promotionRole.toString()) : null;
            const captainRole = settings.captainRole ? Util.getRole(message.guild, settings.captainRole.toString()) : null;

            const settingsObj = {
                'Players': settings.playerCount,
                'Enabled': `${settings.enabled ? 'Yes' : 'No'}`,
                'Teams': settings.teamCount,
                'Default Pickup': `${settings.isDefaultPickup ? 'Yes' : 'No'}`,
                'Pick mode': settings.pickMode,
                'Rated': `${settings.rated ? 'rated' : 'unrated'}`,
                'Max rank rating cap': `${settings.maxRankRatingCap ? settings.maxRankRatingCap : '-'}`,
                'AFK Check': `${settings.afkCheck ? 'enabled' : 'disabled'}`,
                'Captain selection': settings.captainSelection,
                'Server': serverName,
                '\u200B': '\u200B',
                'Map pool': mapPoolName,
                'Map vote': `${settings.mapvote ? 'enabled' : 'disabled'}`,
                '\u200B ': '\u200B',
                'Allowlist role': `${allowlistRole ? allowlistRole.name : '-'}`,
                'Denylist role': `${denylistRole ? denylistRole.name : '-'}`,
                'Promotion role': `${promotionRole ? promotionRole.name : '-'}`,
                'Captain role': `${captainRole ? captainRole.name : '-'}`
            }

            const botAvatarUrl = message.guild.client.user.avatarURL();

            const settingsEmbed = new Discord.EmbedBuilder()
                .setColor('#126e82')
                .setTitle(`:gear: Pickup settings - ${settings.name}`)
                .addFields(
                    {
                        name: 'Property',
                        value: Object.getOwnPropertyNames(settingsObj).join('\n'),
                        inline: true
                    },
                    {
                        name: 'Value',
                        value: Object.values(settingsObj).join('\n'),
                        inline: true
                    }
                )
                .setFooter({ text: `${config.webserver.domain}/help/pickupvariables`, iconURL: botAvatarUrl});

            message.channel.send({ embeds: [settingsEmbed] });
        }
    }
}

module.exports = command;