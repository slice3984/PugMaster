import Discord from 'discord.js';
import { Command } from '../core/types';
import GuildModel from '../models/guild';
import Util from '../core/util';

const command: Command = {
    cmd: 'bans',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'perm',
                    description: 'Show permanent bans',
                    type: 'STRING',
                    choices: [{
                        name: 'true',
                        value: 'perm'
                    }]
                }
            ]
        },
    },
    category: 'info',
    shortDesc: 'List banned players',
    desc: 'List banned players',
    args: [
        { name: '[perm]', desc: 'Pass perm as argument to display all permbans', required: false }
    ],
    defaults: [
        {
            type: 'string', name: 'show_issuer', desc: 'Display issuers as well in bans',
            value: 'true', possibleValues: ['true', 'false']
        }
    ],
    global: true,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        let displayPerms = false;
        const displayIssuers = defaults[0] === 'true';
        let bans;

        const bannedPlayers = [];
        const issuers = [];
        const times = [];
        const reasons = [];

        if (params.length > 0) {
            if (params[0].toLowerCase() !== 'perm') {
                return await Util.send(message ? message : interaction, 'error', 'did you mean perm?');
            }

            displayPerms = true;
            bans = await GuildModel.getBans(BigInt(guild.id), 'perms_only', 11);
        } else {
            bans = await GuildModel.getBans(BigInt(guild.id), 'timed', 11);
        }

        if (!bans.length) {
            return await Util.send(message ? message : interaction, 'info', `no ${displayPerms ? 'permbans' : 'bans'} found`);
        }

        bans.forEach((ban, index) => {
            if (index === 10) {
                return;
            }

            const timeLeft = !displayPerms ? Util.formatTime(ban.ends_at.getTime() - new Date().getTime(), true) : 'Permanent';
            const issuer = ban.issuer;

            let reason = ban.reason;

            if (reason && reason.length > 30) {
                reason = reason.substr(0, 30) + '...';
            }

            bannedPlayers.push(`${ban.banid} - ${Util.removeMarkdown(ban.player)}${displayIssuers ? '\n' : ''}`);
            times.push(`${timeLeft}${displayIssuers ? '\n' : ''}`);
            issuers.push(Util.removeMarkdown(issuer));
            reasons.push(reason ? reason : '-');
        });

        let fieldData: Discord.EmbedFieldData[];

        if (displayIssuers) {
            const issuerReasonColumn = issuers.map((issuer, idx) => `${issuer}\n${reasons[idx]}`);

            fieldData = [
                { name: 'Ban id / Player', value: bannedPlayers.join('\n'), inline: true },
                { name: 'Time left', value: times.join('\n'), inline: true },
                { name: 'Issuer / Reason', value: issuerReasonColumn.join('\n'), inline: true }
            ]
        } else {
            fieldData = [
                { name: 'Ban id / Player', value: bannedPlayers.join('\n'), inline: true },
                { name: 'Time left', value: times.join('\n'), inline: true },
                { name: 'Reason', value: reasons.join('\n'), inline: true }
            ]
        }

        const botAvatarUrl = guild.client.user.avatarURL();

        const bansCardEmbed = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(`${displayPerms ? 'Permbanned' : 'Banned'} players`)
            .addFields(fieldData)
            .setFooter(`Limited to 10 bans${bans.length > 10 ? ', one or more active bans not displayed' : ''}`, botAvatarUrl);

        if (interaction) {
            interaction.reply({ embeds: [bansCardEmbed] });
        } else {
            message.channel.send({ embeds: [bansCardEmbed] });
        }
    }
}

module.exports = command;