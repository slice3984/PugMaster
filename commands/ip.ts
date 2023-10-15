import { ApplicationCommandOptionData, ApplicationCommandOptionType } from 'discord.js';
import Bot from '../core/bot';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'ip',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to display the IP & Password',
                    type: ApplicationCommandOptionType.String,
                    choices: [],
                    required: true
                }
            ];

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();

            enabledPickups.forEach(pickup => {
                options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
    shortDesc: 'Displays the IP & Password for a given pickup if set',
    desc: 'Displays the IP & Password for a given pickup if set',
    args: [
        { name: '<pickup>', desc: 'Pickup to get the server from', required: true }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const pickupName = params[0].toLowerCase();
        const guild = interaction ? interaction.guild : message.guild;

        if (!await (await PickupModel.areValidPickups(BigInt(guild.id), true, pickupName)).length) {
            return Util.send(message ? message : interaction, 'error', `pickup **${pickupName}** not found`);
        }

        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupName);

        // Go for default guild server
        if (!pickupSettings.serverId) {
            const guildSettings = bot.getGuild(guild.id);

            if (!guildSettings.defaultServer) {
                return Util.send(message ? message : interaction, 'info', `No server set for **${pickupName}**`);
            }

            const server = await ServerModel.getServer(BigInt(guild.id), guildSettings.defaultServer);
            return Util.send(message ? message : interaction, 'info', `**${server.name}** server - IP: **${server.ip}**${server.password ? ` Password: **${server.password}**` : ''}`, false);
        } else {
            const server = await ServerModel.getServer(BigInt(guild.id), pickupSettings.serverId);
            return Util.send(message ? message : interaction, 'info', `**${server.name}** server - IP: **${server.ip}**${server.password ? ` Password: **${server.password}**` : ''}`, false);
        }
    }
}

module.exports = command;