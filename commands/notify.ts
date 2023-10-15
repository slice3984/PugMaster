import { ApplicationCommandOptionType, GuildMember } from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import PlayerModel from '../models/player';

const command: Command = {
    cmd: 'notify',
    applicationCommand: {
        global: true,
        parameterSubCommands: ['status'],
        getOptions: () => {
            return [
                {
                    name: 'status',
                    description: 'Shows if your notify is enabled or disabled',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'toggle',
                    description: 'Toggles your notify, enables or disables it',
                    type: ApplicationCommandOptionType.Subcommand
                }
            ]
        }
    },
    category: 'pickup',
    shortDesc: 'DM notification on pickup start',
    desc: 'DM notification on pickup start',
    args: [
        { name: '[status]', desc: 'Call with status to see if it is currently enabled or disabled', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        await PlayerModel.storeOrUpdatePlayer(BigInt(guild.id), BigInt(member.id), member.displayName);
        const isEnabled = await PlayerModel.isNotifyEnabled(BigInt(guild.id), BigInt(member.id));

        if (params.length >= 1) {
            if (params[0].toLowerCase() !== 'status') {
                return Util.send(message ? message : interaction, 'error', 'invalid argument given, do you mean **status**?');
            }

            Util.send(message ? message : interaction, 'info', `your dm notifications for pickup starts are **${isEnabled ? 'enabled' : 'disabled'}**`);
        } else {
            await PlayerModel.toggleNotify(BigInt(guild.id), BigInt(member.id));
            Util.send(message ? message : interaction, 'success', `**${isEnabled ? 'disabled' : 'enabled'}** dm notifications for pickup starts`);
        }
    }
}

module.exports = command;