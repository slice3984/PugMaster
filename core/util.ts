import Discord from 'discord.js';
import GuildModel from '../models/guild';
import Bot from './bot';
import { ValidationError, TimeError } from './types';

export default class Util {
    private constructor() { }

    static async getUser(guild: Discord.Guild, identifier: string, global = false) {
        let id: string | RegExpMatchArray = identifier.match(/<@!(\d+)>/);

        if (!id) {
            if (!/\d+/.test(identifier)) {
                return null;
            } else {
                id = identifier;
            }
        } else {
            id = id[1];
        }

        if (global) {
            const bot = Bot.getInstance();

            try {
                const user = await bot.getClient().users.fetch(id);
                return user;
            } catch (_err) {
                return null;
            }
        } else {
            const user = guild.members.cache.get(id);
            return user;
        }
    }

    static getRole(guild: Discord.Guild, identifier: string) {
        let id: string | RegExpMatchArray = identifier.match(/<@&(\d+)>/);

        if (!id) {
            if (!/\d+/.test(identifier)) {
                // By name
                return guild.roles.cache.find(role => role.name.toLowerCase() == identifier.toLowerCase());
            } else {
                return guild.roles.cache.get(identifier);
            }
        } else {
            return guild.roles.cache.get(id[1]);
        }
    }

    static getChannel(guild: Discord.Guild, identifier: string) {
        let id: string | RegExpMatchArray = identifier.match(/<#(\d+)>/);

        if (!id) {
            if (!/\d+/.test(identifier)) {
                // By name
                return guild.channels.cache.find(chan => chan.name.toLowerCase() === identifier.toLowerCase());
            } else {
                return guild.channels.cache.get(identifier);
            }
        } else {
            return guild.channels.cache.get(id[1]);
        }
    }

    static async getPickupChannel(guild: Discord.Guild) {
        return Util.getChannel(guild, await GuildModel.getPickupChannel(BigInt(guild.id))) as Discord.TextChannel;
    }

    static formatTime(ms: number) {
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

        return stringParts.join(' and ');
    }

    static validateTimeString(timeString: string, maxInMs: number, minInMs: number): TimeError | number {
        if (!/^(\d+[mhdw]\s*)+$/m.test(timeString)) {
            return 'invalid';
        }

        const timeParts = timeString.split(' ');

        for (const part of timeParts) {
            if ((part.length - 1) > maxInMs.toString().length) {
                return 'exceeded';
            }
        }

        const time = Util.timeStringToTime(timeString) * 60 * 1000;

        if (time > maxInMs) {
            return 'exceeded';
        }

        if (time < minInMs) {
            return 'subceeded';
        }

        return time;
    }

    static timeStringToTime(timeString: string) {
        const regex = /(\d+)[mhdw]/g;
        const matches = timeString.match(regex);
        let sum = 0;

        if (!matches) {
            return null;
        }

        matches.forEach(match => {
            const amount = match.charAt(match.length - 1);
            const time = match.substr(0, match.length - 1);

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
        });
        return sum;
    }
}