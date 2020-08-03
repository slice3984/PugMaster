import { Command } from '../core/types';
import { Validator } from '../core/validator';
import PickupModel from '../models/pickup';
import Util from '../core/util';
import MappoolModel from '../models/mappool';
import ServerModel from '../models/server';


const command: Command = {
    cmd: 'modify_pickup',
    aliases: ['modify_pu'],
    shortDesc: 'Modify or show the settings of a pickup',
    desc: 'Modify or show the settings of a pickup',
    args: [
        { name: '<pickup>', desc: 'pickup name', required: true },
        { name: '<key/show>', desc: 'Setting to change or show to display the current configuration', required: true },
        { name: '[value/none]', desc: 'Value of the change, none to disable', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const pickup = params[0].toLowerCase();
        const key = params[1].toLowerCase();

        if (params.length > 2) {
            const value = params[2];

            const dbColumnNames = ['player_count', 'team_count', 'is_default_pickup', 'afk_check', 'pick_mode', 'whitelist_role',
                'blacklist_role', 'promotion_role', 'captain_role', 'server_id', 'mappool_id', 'server_id'];
            const keyNames = ['players', 'teams', 'default', 'afkcheck', 'pickmode', 'whitelist', 'blacklist', 'promotion', 'captain', 'server', 'mappool', 'server'];
            let dbColumn = keyNames.includes(key) ? dbColumnNames[keyNames.indexOf(key)] : key;

            const keyisValid = Validator.Pickup.areValidKeys(key);

            if (keyisValid.length) {
                return message.reply(`unknown setting ${key}`);
            }

            // Clear value if possible
            if (value === 'none') {
                if (['name', 'players', 'teams', 'default', 'afkcheck', 'pickmode'].includes(key)) {
                    return message.reply('you can\'t disable this property');
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, null);
                return message.reply(`successfully disabled ${key} property for pickup ${pickup}, using server default if set`);
            }

            const error = await Validator.Pickup.validate(message.guild, pickup, { key, value });

            if (error.length) {
                return message.reply(error[0].errorMessage);
            }

            const pickupSettings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickup);
            const currentValue = pickupSettings[dbColumn];

            // Get role names for the given role string
            if (['whitelist', 'blacklist', 'promotion', 'captain'].includes(key)) {
                const newRole = Util.getRole(message.guild, value);
                const oldRole = currentValue ? Util.getRole(message.guild, currentValue) : null;

                if (oldRole && oldRole.id === newRole.id) {
                    return message.reply(`${key} is already set to ${oldRole.name} for pickup ${pickup}`);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, newRole.id);
                message.reply(`successfully updated pickup ${pickup}, set ${key} to ${newRole.name}`);
            } else if (key === 'mappool') {
                const poolId = await (await MappoolModel.getPools(BigInt(message.guild.id), value))[0].id;

                if (currentValue && currentValue === poolId) {
                    return message.reply(`${key} is already set to ${value} for pickup ${pickup}`);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, poolId);
                message.reply(`successfully updated pickup ${pickup}, set map pool to ${value}`);
            } else if (key === 'server') {
                const serverId = await ServerModel.getServerIds(BigInt(message.guild.id), value);

                if (currentValue && currentValue === serverId[0]) {
                    return message.reply(`${key} is already set to ${value} for pickup ${pickup}`);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, serverId[0]);
                message.reply(`successfully updated pickup ${pickup}, set server to ${value}`);
            } else {
                if (currentValue && currentValue.toString() === value) {
                    return message.reply(`${key} is already set to ${value} for pickup ${pickup}`);
                }

                await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, value);
                message.reply(`successfully updated pickup ${pickup}, set ${key} to ${value}`);
            }
        } else {
            if (key !== 'show') {
                return message.reply('invalid argument given, do you mean show?');
            }

            const isValidPickup = await Validator.Pickup.isValidPickup(BigInt(message.guild.id), pickup);

            if (!isValidPickup) {
                return message.reply(`pickup ${pickup} not found`);
            }

            const settings = await PickupModel.getPickupSettings(BigInt(message.guild.id), pickup);

            const mapPoolName = settings.mapPoolId ? await MappoolModel.getPoolName(BigInt(message.guild.id), settings.mapPoolId) : '-';
            const serverName = settings.serverId ? await (await ServerModel.getServer(BigInt(message.guild.id), settings.serverId)).name : '-';
            const whitelistRole = settings.whitelistRole ? Util.getRole(message.guild, settings.whitelistRole.toString()) : null;
            const blacklistRole = settings.blacklistRole ? Util.getRole(message.guild, settings.blacklistRole.toString()) : null;
            const promotionRole = settings.promotionRole ? Util.getRole(message.guild, settings.promotionRole.toString()) : null;
            const captainRole = settings.captainRole ? Util.getRole(message.guild, settings.captainRole.toString()) : null;

            const infoString =
                `__Configuration **${settings.name}** pickup__\n` +
                `Players/Teams: **${settings.playerCount}** / **${settings.teamCount}**\n` +
                `Default Pickup: **${settings.isDefaultPickup ? 'yes' : 'no'}**\n` +
                `AFK check: **${settings.afkCheck ? 'enabled' : 'disabled'}**\n` +
                `Pick mode: **${settings.pickMode}**\n` +
                `Map pool: **${mapPoolName}**\n` +
                `Server: **${serverName}**\n` +
                `Whitelist role: **${whitelistRole ? whitelistRole.name : '-'}**\n` +
                `Blacklist role: **${blacklistRole ? blacklistRole.name : '-'}**\n` +
                `Promotion role: **${promotionRole ? promotionRole.name : '-'}**\n` +
                `Captain role: **${captainRole ? captainRole.name : '-'}**\n`;

            message.channel.send(infoString);
        }
    }
}

module.exports = command;