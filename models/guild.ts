import Discord from 'discord.js';
import { GuildSettings, ChannelType } from '../core/types';
import db from '../core/db';

export default class Guild {
    private constructor() { }

    static async isGuildStored(guildId: bigint): Promise<boolean> {
        const stored = await db.query(`SELECT COUNT(*) AS cnt FROM guilds WHERE guild_id = ${guildId}`);
        return stored[0][0].cnt;
    }

    static async createGuild(guild: Discord.Guild): Promise<string> {
        const guildId = BigInt(guild.id);
        const name = guild.name;

        await db.execute(`
        INSERT INTO guilds (guild_id, name)
        VALUES (?, ?)
        `, [guildId, name]);
        return name;
    }

    static async isGuildBanned(guildId: bigint): Promise<boolean> {
        const isBanned = await db.query(`SELECT COUNT(*) AS banned FROM banned_guilds WHERE guild_id = ${guildId}`);
        return isBanned[0][0].banned;
    }

    static async getGuildSettings(guildId: bigint): Promise<GuildSettings> {
        let data = await db.query(`
        SELECT * FROM guilds WHERE guild_id = ${guildId}
        `);
        data = data[0][0];

        return {
            id: guildId,
            prefix: data.prefix,
            promotionRole: data.global_promotion_role,
            blacklistRole: data.global_blacklist_role,
            whitelistRole: data.global_whitelist_role,
            lastPromote: data.last_promote,
            globalExpireTime: data.global_expire,
            disabledCommands: [],
            commandSettings: new Map(),
            channels: new Map()
            // TODO: Load disabled commands & command settings
        }
    }
}