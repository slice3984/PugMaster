import { ApplicationCommandOptionData, ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'server',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'all',
                    description: 'Show all stored servers',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'server',
                    description: 'Show the server IP & Password of a given server',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'server',
                            description: 'Server to get info for',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: []
                        }
                    ]
                }
            ]

            const servers = await ServerModel.getServers(BigInt(guild.id));

            servers.forEach(server => {
                options[1].options[0].choices.push({
                    name: server.name,
                    value: server.name
                })
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
    shortDesc: 'Shows stored servers',
    desc: 'Shows stored servers',
    args: [
        { name: '[server]', desc: 'Display the given servers ip and password if set', required: false }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        if (!params.length) {
            const servers = await ServerModel.getServers(BigInt(guild.id));

            if (!servers.length) {
                return Util.send(message ? message : interaction, 'info', 'No servers stored', false);
            }

            Util.send(message ? message : interaction, 'info', `Server: ${servers.map(server => `**${server.name}**`).join(', ')}`, false);
        } else {
            const isServerStored = await ServerModel.isServerStored(BigInt(guild.id), params[0].toLowerCase());

            if (!isServerStored) {
                return Util.send(message ? message : interaction, 'error', 'server not found');
            }

            const server = await ServerModel.getServer(BigInt(guild.id), params[0].toLowerCase());

            if (server.password) {
                Util.send(message ? message : interaction, 'info', `Name: **${server.name}** IP: **${server.ip}** Password: **${server.password}**`, false);
            } else {
                Util.send(message ? message : interaction, 'info', `Name: **${server.name}** IP: **${server.ip}**`, false);
            }
        }
    }
}

module.exports = command;