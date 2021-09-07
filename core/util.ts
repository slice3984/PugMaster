import Discord from 'discord.js';
import GuildModel from '../models/guild';
import Bot from './bot';
import { TimeError, PickupSettings, PickupStartConfiguration } from './types';
import ServerModel from '../models/server';
import ConfigTool from './configTool';
import TeamModel from '../models/teams';

export default class Util {
    private constructor() { }

    static async getUser(guild: Discord.Guild, identifier: string, onlyGuildMembers = true): Promise<Discord.User | Discord.GuildMember> {
        let id: string | RegExpMatchArray = identifier.match(/<@!?(\d+)>/);
        if (!id) {
            if (!/\d+/.test(identifier)) {
                return null;
            } else {
                id = identifier;
            }
        } else {
            id = id[1];
        }

        const bot = Bot.getInstance();

        try {
            let user: Discord.User | Discord.GuildMember = await guild.members.fetch(id as Discord.Snowflake);

            if (!user && !onlyGuildMembers) {
                user = await bot.getClient().users.fetch(id as Discord.Snowflake);
                return user;
            }

            return user;
        } catch (_err) {
            return null;
        }
    }

    static async getGuildMembers(guild: Discord.Guild, ids: string[]): Promise<Discord.GuildMember[]> {
        try {
            let users = await guild.members.fetch({ user: ids, withPresences: true });

            return users ? [...users.values()] : [];
        } catch (_) {
            return null;
        }
    }

    static getRole(guild: Discord.Guild, identifier: string) {
        let id: string | RegExpMatchArray = identifier.match(/<@&(\d+)>/);

        if (!id) {
            if (!/\d+/.test(identifier)) {
                // By name
                return guild.roles.cache.find(role => role.name.toLowerCase() == identifier.toLowerCase());
            } else {
                return guild.roles.cache.get(identifier as Discord.Snowflake);
            }
        } else {
            return guild.roles.cache.get(id[1] as Discord.Snowflake);
        }
    }

    static getChannel(guild: Discord.Guild, identifier: string) {
        if (!identifier) {
            return null;
        }

        let id: string | RegExpMatchArray = identifier.match(/<#(\d+)>/);

        if (!id) {
            if (!/\d+/.test(identifier)) {
                // By name
                return guild.channels.cache.find(chan => chan.name.toLowerCase() === identifier.toLowerCase());
            } else {
                return guild.channels.cache.get(identifier as Discord.Snowflake);
            }
        } else {
            return guild.channels.cache.get(id[1] as Discord.Snowflake);
        }
    }

    static async getPickupChannel(guild: Discord.Guild) {
        return Util.getChannel(guild, await GuildModel.getPickupChannel(BigInt(guild.id))) as Discord.TextChannel;
    }

    static formatTime(ms: number, shortFormat = false) {
        const stringParts = [];

        let seconds = (ms / 1000) | 0;
        ms -= seconds * 1000;

        let minutes = (seconds / 60) | 0;
        seconds -= minutes * 60;

        let hours = (minutes / 60) | 0;
        minutes -= hours * 60;

        let days = (hours / 24) | 0;
        hours -= days * 24;

        let weeks = (days / 7) | 0;
        days -= weeks * 7;

        const shorten = Math.sign(minutes) + Math.sign(hours) + Math.sign(days) + Math.sign(weeks) + Math.sign(seconds) > 2;

        if (shorten || shortFormat) {
            if (weeks > 0) {
                stringParts.push(`${weeks}w`);
            }

            if (days > 0) {
                stringParts.push(`${days}d`);
            }

            if (hours > 0) {
                stringParts.push(`${hours}h`);
            }

            if (minutes > 0) {
                stringParts.push(`${minutes}m`);
            }
        } else {
            if (weeks > 0) {
                stringParts.push(`${weeks} week${weeks > 1 ? 's' : ''}`);
            }

            if (days > 0) {
                stringParts.push(`${days} day${days > 1 ? 's' : ''}`);
            }

            if (hours > 0) {
                stringParts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
            }

            if (minutes > 0) {
                stringParts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
            }

            if (seconds > 0 && stringParts.length < 2) {
                stringParts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
            }
        }
        return stringParts.join(shorten ? ' ' : ' and ');
    }

    static validateTimeString(timeString: string, maxInMs: number, minInMs: number, seconds = false): TimeError | number {
        if (!seconds && !/^(\d+[mhdw]\s*)+$/m.test(timeString)) {
            return 'invalid';
        }

        if (seconds && !/^(\d+[smhdw]\s*)+$/m.test(timeString)) {
            return 'invalid';
        }

        const timeParts = timeString.split(' ');

        for (const part of timeParts) {
            if ((part.length - 1) > maxInMs.toString().length) {
                return 'exceeded';
            }
        }

        let time;

        if (seconds) {
            time = Util.timeStringToTime(timeString, seconds) * 1000;
        } else {
            time = Util.timeStringToTime(timeString, seconds) * 60 * 1000;
        }

        if (time > maxInMs) {
            return 'exceeded';
        }

        if (time < minInMs) {
            return 'subceeded';
        }

        return time;
    }

    static timeStringToTime(timeString: string, seconds = false) {
        let regex;

        if (seconds) {
            regex = /(\d+)[smhdw]/g;
        } else {
            regex = /(\d+)[mhdw]/g;
        }

        const matches = timeString.match(regex);
        let sum = 0;

        if (!matches) {
            return null;
        }

        matches.forEach(match => {
            const amount = match.charAt(match.length - 1);
            const time = match.substr(0, match.length - 1);

            if (seconds) {
                switch (amount) {
                    case 's':
                        sum += +time;
                        break;
                    case 'm':
                        sum += +time * 60;
                        break;
                    case 'h':
                        sum += +time * 60 * 60;
                        break;
                    case 'd':
                        sum += +time * 60 * 60 * 24;
                        break;
                    case 'w':
                        sum += +time * 60 * 60 * 24 * 7;
                }
            } else {
                switch (amount) {
                    case 'm':
                        sum += +time;
                        break;
                    case 'h':
                        sum += +time * 60;
                        break;
                    case 'd':
                        sum += +time * 60 * 24;
                        break;
                    case 'w':
                        sum += +time * 60 * 24 * 7;
                }
            }
        });
        return sum;
    }

    static async parseStartMessage(message: string, pickupSettings: PickupSettings, config: PickupStartConfiguration) {
        const guildSettings = Bot.getInstance().getGuild(config.guild.id);

        // %name, %teams, %map, %ip, %password, %pickmode, %drawchance, #placeholder[only display if it exists]
        const placeHolders = ['%name', '%teams', '%map', '%ip', '%password', '%pickmode', '%drawchance'];

        // Remove conditions for placeholders which will always exist
        message = message.replace(/(%name|%teams)\[(.*?)\]/g, '$2');

        // Only allow one placeholder of each kind
        placeHolders.forEach(placeholder => {
            let alreadyUsed = false;
            message = message.replace(new RegExp(`${placeholder}(?!\\[)`, 'gm'), match => {
                if (!alreadyUsed) {
                    alreadyUsed = true;
                    return match;
                }
                return '';
            });
        });

        // Replace with the correct values if possible
        for (const placeholder of placeHolders) {
            const toReplace = new RegExp(`${placeholder}(?!\\[)`);

            let server;
            switch (placeholder) {
                case '%name':
                    message = message.replace(placeholder, pickupSettings.name);
                    break;
                case '%teams':
                    const formattedTeams = [];
                    if (!Array.isArray(config.teams[0])) {
                        formattedTeams.push('Players', (config.teams as bigint[]).map(id => `<@${id.toString()}>`).join(', '));
                    } else {
                        const storedTeams = await TeamModel.getTeams(BigInt(config.guild.id));

                        config.teams.forEach((team, index) => {
                            const teamId = String.fromCharCode(65 + index);

                            const storedTeam = storedTeams.find(t => t.teamId === teamId);
                            const teamName = storedTeam ? storedTeam.name : teamId;

                            formattedTeams.push(`Team ${teamName}`);
                            formattedTeams.push(team.map(id => `<@${id.toString()}>`).join(', '));
                        });
                    }
                    message = message.replace(placeholder, formattedTeams.join('\n'));
                    break;
                case '%map':
                    if (!config.map) {
                        message = message.replace(/\n%map\[.*?\]\n/g, '\n');
                        message = message.replace(/%map\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    message = message.replace(/(%map)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, config.map);
                    break;
                case '%ip':
                    if (!pickupSettings.serverId && !guildSettings.defaultServer) {
                        message = message.replace(/\n%ip\[.*?\]\n/g, '\n');
                        message = message.replace(/%ip\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    if (!server) {
                        if (pickupSettings.serverId) {
                            server = await ServerModel.getServer(BigInt(config.guild.id), pickupSettings.serverId);
                        } else {
                            server = await ServerModel.getServer(BigInt(config.guild.id), guildSettings.defaultServer);
                        }
                    }

                    message = message.replace(/(%ip)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, server.ip);
                    break;
                case '%password':
                    if (!pickupSettings.serverId && !guildSettings.defaultServer) {
                        message = message.replace(/\n%password\[.*?\]\n/g, '\n');
                        message = message.replace(/%password\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    if (!server) {
                        if (pickupSettings.serverId) {
                            server = await ServerModel.getServer(BigInt(config.guild.id), pickupSettings.serverId);
                        } else {
                            server = await ServerModel.getServer(BigInt(config.guild.id), guildSettings.defaultServer);
                        }
                    }

                    if (!server.password) {
                        message = message.replace(/\n%password\[.*?\]\n/g, '\n');
                        message = message.replace(/%password\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    message = message.replace(/(%password)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, server.password);
                    break;
                case '%pickmode':
                    const mode = pickupSettings.pickMode === 'no_teams' ? 'no teams' : pickupSettings.pickMode;
                    message = message.replace(placeholder, mode);
                    break;
                case '%drawchance':
                    if (!config.drawProbability) {
                        message = message.replace(/\n%drawchance\[.*?\]\n/g, '\n');
                        message = message.replace(/%drawchance\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    const drawchance = Math.round(config.drawProbability * 100);

                    message = message.replace(/(%drawchance)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, drawchance.toString());
            }
        }
        return message;
    }

    static async parseNotifySubMessage(guildId: bigint, message: string, pickupSettings: PickupSettings) {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        // %name, %ip, %password, #placeholder[only display if it exists]
        const placeHolders = ['%name', '%ip', '%password'];

        message = message.replace(/(%name)\[(.*?)\]/g, '$2');

        placeHolders.forEach(placeholder => {
            let alreadyUsed = false;
            message = message.replace(new RegExp(`${placeholder}(?!\\[)`, 'gm'), match => {
                if (!alreadyUsed) {
                    alreadyUsed = true;
                    return match;
                }
                return '';
            });
        });

        for (const placeholder of placeHolders) {
            const toReplace = new RegExp(`${placeholder}(?!\\[)`);

            let server;
            switch (placeholder) {
                case '%name':
                    message = message.replace(placeholder, pickupSettings.name);
                    break;
                case '%ip':
                    if (!pickupSettings.serverId && !guildSettings.defaultServer) {
                        message = message.replace(/\n%ip\[.*?\]\n/g, '\n');
                        message = message.replace(/%ip\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    if (!server) {
                        if (pickupSettings.serverId) {
                            server = await ServerModel.getServer(guildId, pickupSettings.serverId);
                        } else {
                            server = await ServerModel.getServer(guildId, guildSettings.defaultServer);
                        }
                    }

                    message = message.replace(/(%ip)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, server.ip);
                    break;
                case '%password':
                    if (!pickupSettings.serverId && !guildSettings.defaultServer) {
                        message = message.replace(/\n%password\[.*?\]\n/g, '\n');
                        message = message.replace(/%password\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    if (!server) {
                        if (pickupSettings.serverId) {
                            server = await ServerModel.getServer(guildId, pickupSettings.serverId);
                        } else {
                            server = await ServerModel.getServer(guildId, guildSettings.defaultServer);
                        }
                    }

                    if (!server.password) {
                        message = message.replace(/\n%password\[.*?\]\n/g, '\n');
                        message = message.replace(/%password\[.*?\]/g, '');
                        message = message.replace(toReplace, '');
                        break;
                    }

                    message = message.replace(/(%password)\[(.*?)\]/g, '$2');
                    message = message.replace(toReplace, server.password);
            }
        }
        return message;
    }

    static shuffleArray<T>(arr: T[]): T[] {
        return arr
            .map(a => ({ sort: Math.random(), value: a }))
            .sort((a, b) => a.sort - b.sort)
            .map(a => a.value);
    }

    static removeObjectArrayDuplicates<T>(arr: T[], propertyToCheck: string): T[] {
        return [...new Map(arr.map(obj => [obj[propertyToCheck], obj])).values()];
    }

    static getBotEmoji(type: 'success' | 'info' | 'warn' | 'error') {
        const configEmojis = ConfigTool.getConfig().emojis;

        switch (type) {
            case 'success':
                return configEmojis.success.length ? configEmojis.success : ':white_check_mark:';
            case 'info':
                return configEmojis.info.length ? configEmojis.info : ":information_source:";
            case 'warn':
                return configEmojis.warn.length ? configEmojis.warn : ":warning:";
            case 'error':
                return configEmojis.error.length ? configEmojis.error : ":x:";
        }
    }

    static formatMessage(type: 'success' | 'info' | 'warn' | 'error', msg: string) {
        const icon = this.getBotEmoji(type);
        return `${icon} **|** ${msg}`;
    }

    static tsToEloNumber(skill: number) { return Math.ceil(skill * 100) }

    static tsToRankIcon(mu: number, sigma: number, ratingCap: number) {
        const skill = this.tsToEloNumber(mu - (3 * sigma));
        const ratingPerRank = ratingCap / 15;
        let rank = Math.round(skill / ratingPerRank);

        rank = !rank || rank < 0 ? 1 : rank;
        rank = rank > 15 ? 15 : rank;

        return rank;
    }

    static send = async (input: Discord.Message | Discord.CommandInteraction,
        type: 'success' | 'info' | 'warn' | 'error', message: string, includeAuthor = true) => {

        if (includeAuthor) {
            if (input instanceof Discord.Message) {
                message = `${input.author}, ${message}`;
            } else {
                message = `${input.member.toString()}, ${message}`;
            }
        }

        const msg = type ? Util.formatMessage(type, message) : message;

        if (input instanceof Discord.Message) {
            await input.channel.send(msg);
        } else {
            await input.reply(msg);
        }
    }

    static gotPermissions = (input: Discord.Message | Discord.CommandInteraction | Discord.TextChannel,
        ...permissions: Discord.PermissionString[]): Discord.MessageEmbed => {
        const bot = Bot.getInstance();

        let channel;

        if (input instanceof Discord.TextChannel) {
            channel = input as Discord.TextChannel;
        } else {
            channel = input.channel as Discord.TextChannel;
        }

        const perms = channel.permissionsFor(bot.getClient().user);
        const missingPermissions = [];

        permissions.forEach(requiredPerm => {
            if (!perms.has(requiredPerm)) {
                missingPermissions.push(`**- ${requiredPerm.split('_').join(' ').toLowerCase()}**`);
            }
        });

        if (missingPermissions.length) {
            // Missing permissions embed
            const permissionsEmbed = new Discord.MessageEmbed()
                .setTitle(`${Util.getBotEmoji('error')} Permissions missing`)
                .setColor('#ff0000')
                .setDescription(missingPermissions.join('\n'));

            return permissionsEmbed;
        }

        return null;
    }
}

export const debounce = (func: Function, delay: number) => {
    let timeout;
    return (...args) => {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
};