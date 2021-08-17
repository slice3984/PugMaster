import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';
import { GuildMember } from 'discord.js';

const command: Command = {
    cmd: 'ao',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'show',
                    description: 'Show your ao status',
                    type: 'STRING',
                    choices: [{
                        name: 'true',
                        value: 'show'
                    }],
                }
            ]
        }
    },
    category: 'pickup',
    shortDesc: 'Enables / disables or shows the status of your allow offline',
    desc: 'Enables / disables or shows the status of your allow offline, ao prevents removal on offline status',
    args: [
        { name: '[show]', desc: 'call with show to show how much time is left until your ao expires', required: false }
    ],
    defaults: [
        { type: 'time', name: 'max-duration', desc: 'Duration of the allow offline', value: 21600000, possibleValues: { from: 3600000, to: 86400000 } }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guildId = interaction ? interaction.guild.id : message.guild.id;
        const memberId = interaction ? (interaction.member as GuildMember).id : message.member.id;

        if (params.length === 0) {
            const ao = await PlayerModel.getAos(BigInt(guildId), memberId);

            if (!ao) {
                await PlayerModel.setAo(BigInt(guildId), BigInt(memberId), defaults[0]);

                return Util.send(message ? message : interaction, 'success', `ao enabled, you will have offline immunity for ${Util.formatTime(defaults[0])}`);
            } else {
                await PlayerModel.removeAos(BigInt(guildId), memberId);

                return Util.send(message ? message : interaction, 'success', 'your ao got removed');
            }
        }

        if (params[0] === 'show') {
            const ao = await PlayerModel.getAos(BigInt(guildId), memberId);

            if (!ao) {
                return Util.send(message ? message : interaction, 'info', 'you got no active ao');
            }

            const timeLeft = ao[0].ao_expire.getTime() - new Date().getTime();
            Util.send(message ? message : interaction, 'info', `your ao will expire in ${Util.formatTime(timeLeft)}`);
        }
    }
}

module.exports = command;