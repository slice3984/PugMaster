import { Command } from '../core/types';
import Util from '../core/util';
import { Validator } from '../core/validator';
import MappoolModel from '../models/mappool';

const command: Command = {
    cmd: 'create_mappool',
    category: 'admin',
    aliases: ['create_mp'],
    shortDesc: 'Creates a map pool which can be assigned to pickups',
    desc: 'Creates a map pool which can be assigned to pickups',
    args: [
        { name: '<name>', desc: 'Name of the map pool', required: true },
        { name: '<map...>', desc: 'One or multiple map names', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const name = params[0].toLowerCase();
        const maps = params.slice(1).map(map => map.toLowerCase());

        const isValid = await Validator.Mappool.isValidPool(BigInt(message.guild.id), name, false);

        if (isValid !== true) {
            return Util.send(message, 'error', isValid.errorMessage);
        }

        const validMaps = [...new Set(Validator.Mappool.areValidMapNames(...maps))];
        if (validMaps.length === 0) {
            return Util.send(message, 'error', 'no valid map names given, are the map names in a range of 1-45 chars?');
        }

        await MappoolModel.addMappool(BigInt(message.guild.id), name);
        await MappoolModel.addMapsToPool(BigInt(message.guild.id), name, ...validMaps);

        await bot.updateGuildApplicationCommand('mappool', message.guild);
        Util.send(message, 'success', `Created map pool **${name}** with the following maps: ${validMaps.map(map => `**${map}**`).join(', ')}`, false)
    }
}

module.exports = command;