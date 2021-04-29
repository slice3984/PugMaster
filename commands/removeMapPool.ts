import { Command } from '../core/types';
import Util from '../core/util';
import { Validator } from '../core/validator';
import MappoolModel from '../models/mappool';

const command: Command = {
    cmd: 'remove_mappool',
    category: 'admin',
    aliases: ['remove_mp'],
    shortDesc: 'Remove one or multiple map pools',
    desc: 'Remove one or multiple map pools',
    args: [
        { name: '<name>...', desc: 'Map pool name', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        let validPools = [];

        for (const pool of params) {
            const isValid = await MappoolModel.isMappoolStored(BigInt(message.guild.id), pool);

            if (isValid) {
                validPools.push(pool);
            }
        }

        if (!validPools.length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, given pools not found`));
        }

        await MappoolModel.removeMapPools(BigInt(message.guild.id), ...validPools);
        message.channel.send(Util.formatMessage('success', `Removed map pool ${validPools.map(pool => `**${pool}**`).join(', ')}`));
    }

}

module.exports = command;