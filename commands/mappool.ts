import { Command, ValidationError } from '../core/types';
import MappoolModel from '../models/mappool';
import { Validator } from '../core/validator';
import Util from '../core/util';
import { ApplicationCommandOptionData } from 'discord.js';

const command: Command = {
    cmd: 'mappool',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pool',
                    description: 'Map pool to show maps of',
                    type: 'STRING',
                    choices: []
                }
            ]

            const poolNames = await MappoolModel.getPools(BigInt(guild.id));

            poolNames.map(pool => pool.name).forEach(name => {
                options[0].choices.push({
                    name,
                    value: name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
    aliases: ['mp'],
    shortDesc: 'List map pools or show the maps of a specified one',
    desc: 'List map pools or show the maps of specified one',
    args: [
        { name: '[name]', desc: 'Name of the map pool to show', required: false }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        if (params.length === 0) {
            const pools = await MappoolModel.getPools(BigInt(guild.id));
            if (pools.length === 0) {
                return Util.send(message ? message : interaction, 'info', 'no map pools stored');
            } else {
                const mappools = pools.map(pool => `**${pool.name}**`);
                return Util.send(message ? message : interaction, 'info', `stored map pools: ${mappools.join(', ')}`);
            }
        } else {
            const name = params[0].toLowerCase();
            const isValid = await Validator.Mappool.isValidPool(BigInt(guild.id), name, true);

            if (isValid !== true) {
                return Util.send(message ? message : interaction, 'error', (isValid as ValidationError).errorMessage);
            }

            const maps = await MappoolModel.getMaps(BigInt(guild.id), name);
            return Util.send(message ? message : interaction, 'info', `map pool **${name}** contains the following maps: ${maps.map(map => `**${map}**`).join(', ')}`);
        }
    }
}

module.exports = command;