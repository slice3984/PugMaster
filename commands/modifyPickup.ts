import { Command } from '../core/types';
import { Validator } from '../core/validator';
import PickupModel from '../models/pickup';
import Util from '../core/util';


const command: Command = {
    cmd: 'modify_pickup',
    aliases: ['modify_pu'],
    shortDesc: 'Modify the settings of a pickup',
    desc: 'Modify the settings of a pickup',
    args: [
        { name: '<pickup>', desc: 'pickup name', required: true },
        { name: '<key>', desc: 'Setting to change', required: true },
        { name: '<value/none>', desc: 'Value of the change, none to disable', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const pickup = params[0].toLowerCase();
        const key = params[1].toLowerCase();
        const value = params[2];

        const dbColumnNames = ['player_count', 'team_count', 'is_default_pickup', 'afk_check', 'pick_mode', 'whitelist_role',
            'blacklist_role', 'promotion_role', 'captain_role', 'server_id'];
        const keyNames = ['players', 'teams', 'default', 'afkcheck', 'pickmode', 'whitelist', 'blacklist', 'promotion', 'captain', 'server'];
        let dbColumn = keyNames.includes(key) ? dbColumnNames[keyNames.indexOf(key)] : key;

        const isValidPickup = await Validator.Pickup.isValidPickup(BigInt(message.guild.id), pickup);

        if (!isValidPickup) {
            return message.reply(`pickup ${pickup} not found`);
        }

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
        } else {
            if (currentValue && currentValue.toString() === value) {
                return message.reply(`${key} is already set to ${value} for pickup ${pickup}`);
            }

            await PickupModel.modifyPickup(BigInt(message.guild.id), pickup, dbColumn, value);
            message.reply(`successfully updated pickup ${pickup}, set ${key} to ${value}`);
        }
    }
}

module.exports = command;