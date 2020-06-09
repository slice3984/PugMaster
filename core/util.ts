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
}