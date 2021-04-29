import { Command } from '../core/types';
import MappoolModel from '../models/mappool';
import { Validator } from '../core/validator';
import Util from '../core/util';

const command: Command = {
    cmd: 'mappool',
    category: 'info',
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
                return message.channel.send(Util.formatMessage('info', 'No map pools stored'));
            } else {
                const mappools = pools.map(pool => `**${pool.name}**`);
                return message.channel.send(Util.formatMessage('info', `Stored map pools: ${mappools.join(', ')}`));
            }
        } else {
            const name = params[0].toLowerCase();
            const isValid = await Validator.Mappool.isValidPool(BigInt(message.guild.id), name, true);

            if (isValid !== true) {
                return message.reply(isValid.errorMessage);
            }

            const maps = await MappoolModel.getMaps(BigInt(message.guild.id), name);
            message.channel.send(Util.formatMessage('info', `Map pool **${name}** contains the following maps: ${maps.map(map => `**${map}**`).join(', ')}`));
        }
    }
}

module.exports = command;