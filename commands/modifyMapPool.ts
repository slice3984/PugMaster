import { Command } from '../core/types';
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
                    return message.reply('no valid map names given, are the map names in a range of 1-45 chars?');
                }

                mapsInPool = await MappoolModel.getMaps(BigInt(message.guild.id), name);
                const mapsToAdd = validMaps.filter(map => !mapsInPool.includes(map));

                if (!mapsToAdd.length) {
                    return message.reply(`given maps are already stored in ${name}`);
                }

                await MappoolModel.addMapsToPool(BigInt(message.guild.id), name, ...mapsToAdd);

                return message.reply(`successfully added the following maps: ${mapsToAdd.join(', ')} to ${name}`);
            case 'remove':
                mapsInPool = await MappoolModel.getMaps(BigInt(message.guild.id), name);
                const toRemove = givenMaps.filter(map => mapsInPool.includes(map));

                if (!toRemove.length) {
                    return message.reply('given maps are not stored in this pool');
                }

                if (mapsInPool.length === toRemove.length) {
                    return message.reply(`can't remove all maps from a pool, use ${bot.getGuild(message.guild.id).prefix}remove_mappool to remove the entire pool`);
                }

                MappoolModel.removeMapsFromPool(BigInt(message.guild.id), name, ...toRemove);
                return message.reply(`removed the following maps: ${toRemove.join(', ')} from pool ${name}`);
            default:
                message.reply('invalid operation, has to be add or remove');
        }
    }
}

module.exports = command;