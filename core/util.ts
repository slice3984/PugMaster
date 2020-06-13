import Discord from 'discord.js';
import Bot from './bot';

const bot = Bot.getInstance();

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

    static formatTime(ms: number) {
        const mins = Math.floor((ms / 60000) % 60);
        const hours = Math.floor((ms / 60000) / 60);

        if (hours < 1) {
            if (mins == 1) {
                return mins + " minute";
            } else {
                return mins + " minutes";
            }
        } else if (hours == 1) {
            if (mins < 1) {
                return hours + " hour";
            } else if (mins == 1) {
                return hours + " hour and " + mins + " minute";
            } else {
                return hours + " hour and " + mins + " minutes";
            }
        } else {
            if (mins < 1) {
                return hours + " hours";
            } else if (mins == 1) {
                return hours + " hours and " + mins + " minute";
            } else {
                return hours + " hours and " + mins + " minutes";
            }
        }
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