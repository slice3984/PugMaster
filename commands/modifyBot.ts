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
                return message.reply(errors[0].errorMessage);
            }

            message.reply(`successfully updated ${key} to ${value}`);
        } else {
            if (key !== 'show') {
                return message.reply('invalid argument given, do you mean show?');
            }

            const settings = bot.getGuild(message.guild.id);

            const globalExpireTime = settings.globalExpireTime ? Util.formatTime(settings.globalExpireTime) : 'disabled';
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
                    return message.reply('invalid argument given, do you mean start, sub or notify?')
                }

                let toDisplay = '';

                switch (param) {
                    case 'start': toDisplay = startMessage; break;
                    case 'sub': toDisplay = subMessage; break;
                    case 'notify': toDisplay = notifyMessage;
                }

                infoString = `**__${param} message__**\n${toDisplay}`;
            } else {
                infoString =
                    `**__Server configuration__**\n` +
                    `Prefix: **${settings.prefix}**\n` +
                    `Global expire: **${globalExpireTime}**\n` +
                    `Trust time: **${trustTime}**\n` +
                    `Explicit trust: **${explicitTrust}**\n` +
                    `Default whitelist: **${whitelistRole ? whitelistRole.name : '-'}**\n` +
                    `Default blacklist: **${blacklistRole ? blacklistRole.name : '-'}**\n` +
                    `Promotion delay: **${promotionDelay}**\n` +
                    `Default Server: **${defaultServer}**\n` +
                    `Start message: **${settings.prefix}modify_bot show start**\n` +
                    `Sub message: **${settings.prefix}modify_bot show sub**\n` +
                    `Notify message: **${settings.prefix}modify_bot show notify**\n` +
                    `Iteration time: **${iterationTime}**\n` +
                    `Afk time: **${afkTime}**\n` +
                    `Afk check iterations: **${afkCheckIterations}**\n` +
                    `Picking iterations: **${pickingIterations}**\n` +
                    `Max warn streaks: **${warnStreaks}**\n` +
                    `Warns until ban: **${warnsUntilBan}**\n` +
                    `Warn streak expiration: **${warnStreakExpiration}**\n` +
                    `Warn expiration time: **${warnExpirationTime}**\n` +
                    `Warn bantime: **${warnBanTime}**\n` +
                    `Warn bantime multiplier: **${warnBanTimeMultiplier}**\n`;
            }

            message.channel.send(infoString);
        }
    }
}

module.exports = command;