import Discord from 'discord.js';
import { GuildSettings, ChannelType } from '../core/types';
import Bot from '../core/bot';
import db from '../core/db';

export default class GuildModel {
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

        let guildChannels = await db.query(`
        SELECT * FROM guild_channels
        WHERE guild_id = ${guildId}
        `);

        const channels = new Map();

        guildChannels[0].forEach(channel => {
            channels.set(BigInt(channel.channel_id), channel.channel_type);
        })

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
            channels
            // TODO: Load disabled commands & command settings
        }
    }

    static async getChannelType(guildId: bigint, channelId: bigint) {
        let type = await db.query(`
        SELECT channel_type
        FROM guild_channels
        WHERE guild_id = ${guildId} AND channel_id = ${channelId};
        `);

        if (type[0][0]) {
            return type[0][0].channel_type;
        }

        return;
    }

    static async createChannel(guildId: bigint, channelId: bigint, type: ChannelType) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        for (const [channelId, channelType] of guildChannels) {
            if (channelType === type) {
                guildChannels.delete(channelId);
                break;
            }
        }

        await db.query(`
        DELETE FROM guild_channels
        WHERE guild_id = ${guildId} AND channel_type = '${type}'
        `);

        await db.query(`
        INSERT INTO guild_channels VALUES(${guildId}, ${channelId}, '${type}')
        `);

        guildChannels.set(channelId, type);
    }

    static async updateChannel(guildId: bigint, channelId: bigint, type: ChannelType) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        for (const [channelId, channelType] of guildChannels) {
            if (channelType === type) {
                guildChannels.delete(channelId);
            }
            if (channelId === channelId) {
                guildChannels.set(channelId, type);
            }
        }

        await db.query(`
        UPDATE guild_channels
        SET channel_type = '${type}'
        WHERE guild_id = ${guildId} AND channel_id = ${channelId}
        `);
    }

    static async removeChannel(guildId: bigint, channelId: bigint) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        guildChannels.delete(channelId);

        await db.query(`
        DELETE FROM guild_channels
        WHERE guild_id = ${guildId} AND channel_id = ${channelId}
        `);
    }
}