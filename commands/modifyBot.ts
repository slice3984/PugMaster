import Discord from 'discord.js';
import ConfigTool from '../core/configTool';
import { Command } from '../core/types';
import Util from '../core/util';
import ServerModel from '../models/server';

const command: Command = {
    cmd: 'modify_bot',
    category: 'admin',
    shortDesc: 'Modify server specific settings',
    desc: 'Modify server specific settings',
    args: [
        { name: '<key/show>', desc: 'Show current server settings or which property to modify', required: true },
        { name: '[value/none]', desc: 'The new value of the property or start, sub, notify to show the messages, none to disable', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const key = params[0].toLowerCase();

        if (params.length > 1 && key !== 'show') {
            const value = params.slice(1).join(' ');
            const errors = await bot.getGuild(message.guild.id).modifyProperty({ key, value });

            if (errors.length) {
                return message.channel.send(Util.formatMessage('error', errors[0].errorMessage));
            }

            message.channel.send(Util.formatMessage('success', `Updated property ${key}, set value to ${value}`));
        } else {
            if (key !== 'show') {
                return message.channel.send(Util.formatMessage('error', `${message.author}, invalid argument given, do you mean **show**?`));
            }

            const settings = bot.getGuild(message.guild.id);
            const config = ConfigTool.getConfig();

            const globalExpireTime = settings.globalExpireTime ? Util.formatTime(settings.globalExpireTime) : 'disabled';
            const reportExpiretime = Util.formatTime(settings.reportExpireTime);
            const trustTime = settings.trustTime ? Util.formatTime(settings.trustTime) : 'disabled';
            const explicitTrust = settings.explicitTrust ? 'enabled' : 'disabled';
            const whitelistRole = settings.whitelistRole ? Util.getRole(message.guild, settings.whitelistRole.toString()) : null;
            const blacklistRole = settings.blacklistRole ? Util.getRole(message.guild, settings.blacklistRole.toString()) : null;
            const promotionDelay = Util.formatTime(settings.promotionDelay);
            const defaultServer = settings.defaultServer ? await (await ServerModel.getServer(BigInt(message.guild.id), settings.defaultServer)).name : '-';
            const startMessage = settings.startMessage || '-';
            const subMessage = settings.subMessage || '-';
            const notifyMessage = settings.notifyMessage || '-';
            const iterationTime = Util.formatTime(settings.iterationTime);
            const afkTime = Util.formatTime(settings.afkTime);
            const afkCheckIterations = settings.afkCheckIterations;
            const pickingIterations = settings.pickingIterations;
            const mapvoteIterations = settings.mapvoteIterations;
            const captainSelectionIterations = settings.captainSelectionIterations;
            const maxAvgVariance = settings.maxAvgVariance;
            const maxRankRatingCap = settings.maxRankRatingCap;
            const warnStreaks = settings.warnStreaks;
            const warnsUntilBan = settings.warnsUntilBan;
            const warnStreakExpiration = Util.formatTime(settings.warnStreakExpiration);
            const warnExpirationTime = Util.formatTime(settings.warnExpiration);
            const warnBanTime = Util.formatTime(settings.warnBanTime);
            const warnBanTimeMultiplier = settings.warnBanTimeMultiplier;

            let infoString = '';

            if (params.length > 1) {
                const param = params[1].toLowerCase();

                if (!['start', 'sub', 'notify'].includes(param)) {
                    return message.channel.send(Util.formatMessage('error', `${message.author}, invalid argument given, do you mean **start**, **sub** or **notify**?`))
                }

                let toDisplay = '';

                switch (param) {
                    case 'start': toDisplay = startMessage; break;
                    case 'sub': toDisplay = subMessage; break;
                    case 'notify': toDisplay = notifyMessage;
                }

                infoString = `**${param} message**\n\`\`\`${toDisplay}\`\`\``;

                message.channel.send(infoString);
            } else {
                const settingsObj = {
                    'Prefix': settings.prefix,
                    'Explicit trust': explicitTrust,
                    'Trust time': trustTime,
                    'Global expire': globalExpireTime,
                    'AFK time': afkTime,
                    'Promotion delay': promotionDelay,
                    '\u200B': '\u200B',
                    'Default Server': defaultServer,
                    'Default Whitelist': `${whitelistRole ? whitelistRole.name : '-'}`,
                    'Default Blacklist': `${blacklistRole ? blacklistRole.name : '-'}`,
                    '\u200B ': '\u200B',
                    'Iteration time': iterationTime,
                    'AFK check iterations': afkCheckIterations,
                    'Captain selection iterations': captainSelectionIterations,
                    'Picking iterations': pickingIterations,
                    'Map vote iterations': mapvoteIterations,
                    '\u200B  ': '\u200B',
                    'Report expire': reportExpiretime,
                    'Max average elo variance': maxAvgVariance,
                    'Max rank rating cap': maxRankRatingCap,
                    '\u200B   ': '\u200B',
                    'Max warn streaks': warnStreaks,
                    'Warns until ban': warnsUntilBan,
                    'Warn streak expiration': warnStreakExpiration,
                    'Warn expiration time': warnExpirationTime,
                    'Warn bantime': warnBanTime,
                    'Warn bantime multiplier': warnBanTimeMultiplier,
                    '\u200B    ': '\u200B',
                    '**To display**': '\u200B',
                    'Start message': `${settings.prefix}modify_bot show start`,
                    'Notify message': `${settings.prefix}modify_bot show notify`,
                    'Sub message': `${settings.prefix}modify_bot show sub`
                };

                const botAvatarUrl = message.guild.client.user.avatarURL();

                const settingsEmbed = new Discord.MessageEmbed()
                    .setColor('#126e82')
                    .setTitle(`:gear: Bot settings - ${message.guild.name}`)
                    .addFields(
                        {
                            name: 'Property',
                            value: Object.getOwnPropertyNames(settingsObj).join('\n'),
                            inline: true
                        },
                        {
                            name: 'Value',
                            value: Object.values(settingsObj).join('\n'),
                            inline: true
                        }
                    )
                    .setFooter(`${config.webserver.domain}/help/botvariables`, botAvatarUrl);

                message.channel.send(settingsEmbed);
            }
        }
    }
}

module.exports = command;