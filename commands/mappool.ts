import { Command } from '../core/types';
import MappoolModel from '../models/mappool';
import { Validator } from '../core/validator';

const command: Command = {
    cmd: 'mappool',
    aliases: ['mp'],
    shortDesc: 'List map pools or show the maps of a specified one',
    desc: 'List map pools or show the maps of specified one',
    args: [
        { name: '[name]', desc: 'Name of the map pool to show', required: false }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params) => {
        if (params.length === 0) {
            const pools = await MappoolModel.getPools(BigInt(message.guild.id));
            if (pools.length === 0) {
                return message.reply('no map pools stored');
            } else {
                const maps = pools.map(pool => pool.name);
                return message.reply(`stored map pools: ${maps.join(', ')}`);
            }
        } else {
            const name = params[0].toLowerCase();
            const isValid = await Validator.Mappool.isValidPool(BigInt(message.guild.id), name, true);

            if (isValid !== true) {
                return message.reply(isValid.errorMessage);
            }

            const maps = await MappoolModel.getMaps(BigInt(message.guild.id), name);
            message.reply(`map pool ${name} contains the following maps: ${maps.join(', ')}`);
        }
    }
}

module.exports = command;