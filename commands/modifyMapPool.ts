import { Command } from '../core/types';
import Util from '../core/util';
import { Validator } from '../core/validator';
import MappoolModel from '../models/mappool';

const command: Command = {
    cmd: 'modify_mappool',
    category: 'admin',
    aliases: ['modify_mp'],
    shortDesc: 'Add/Remove maps from a map pool or delete it',
    desc: 'Add/Remove maps from a map pool or delete it',
    args: [
        { name: '<name>', desc: 'Name of the map pool', required: true },
        { name: '<add/remove>', desc: 'Add or remove maps from the pool', required: true },
        { name: '<map>...', desc: 'Maps to add or remove', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const name = params[0].toLowerCase();
        const operation = params[1].toLowerCase();

        const isValid = await Validator.Mappool.isValidPool(BigInt(message.guild.id), name, true);

        if (isValid !== true) {
            return message.reply(isValid.errorMessage);
        }

        const givenMaps = params.slice(2).map(map => map.toLowerCase());
        let mapsInPool;

        switch (operation) {
            case 'add':
                const validMaps = [...new Set(Validator.Mappool.areValidMapNames(...givenMaps))];

                if (validMaps.length === 0) {
                    return Util.send(message, 'error', 'Invalid map names given, are the map names in a range of 1-45 chars?', false);
                }

                mapsInPool = await MappoolModel.getMaps(BigInt(message.guild.id), name);
                const mapsToAdd = validMaps.filter(map => !mapsInPool.includes(map));

                if (!mapsToAdd.length) {
                    return Util.send(message, 'error', `Given maps are already stored in pool **${name}**`, false);
                }

                await MappoolModel.addMapsToPool(BigInt(message.guild.id), name, ...mapsToAdd);

                return Util.send(message, 'success', `Added the following maps: ${mapsToAdd.map(map => `**${map}**`).join(', ')} to pool **${name}**`, false);
            case 'remove':
                mapsInPool = await MappoolModel.getMaps(BigInt(message.guild.id), name);
                const toRemove = givenMaps.filter(map => mapsInPool.includes(map));

                if (!toRemove.length) {
                    return Util.send(message, 'error', `Given maps are not stored in pool **${name}**`, false);
                }

                if (mapsInPool.length === toRemove.length) {
                    return Util.send(message, 'error', `Can't remove all maps from a pool, use **${bot.getGuild(message.guild.id).prefix}remove_mappool** to remove the entire pool`, false);
                }

                MappoolModel.removeMapsFromPool(BigInt(message.guild.id), name, ...toRemove);
                return Util.send(message, 'success', `Removed the following maps: ${toRemove.map(map => `**${map}**`).join(', ')} from pool **${name}**`, false);
            default:
                Util.send(message, 'error', 'Invalid operation, has to be **add** or **remove**');
        }
    }
}

module.exports = command;