import Discord from 'discord.js';
import { GuildSettings, ChannelType } from '../core/types';
import Bot from '../core/bot';
import db from '../core/db';

export default class GuildModel {
    private constructor() { }

    static async isGuildStored(guildId: bigint): Promise<boolean> {
        const stored = await db.execute(`
        SELECT COUNT(*) AS cnt FROM guilds WHERE guild_id = ?
        `, [guildId]);
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
        const isBanned = await db.execute(`
        SELECT COUNT(*) AS banned FROM banned_guilds WHERE guild_id = ?
        `, [guildId]);
        return isBanned[0][0].banned;
    }

    static async getGuildSettings(guildId: bigint): Promise<GuildSettings> {
        let data = await db.execute(`
        SELECT * FROM guilds WHERE guild_id = ?
        `, [guildId]);
        data = data[0][0];

        let guildChannels = await db.execute(`
        SELECT * FROM guild_channels
        WHERE guild_id = ?
        `, [guildId]);

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
            trustTime: data.trust_check ? data.trust_time : null,
            disabledCommands: [],
            commandSettings: new Map(),
            channels
            // TODO: Load disabled commands & command settings
        }
    }

    static async getChannelType(guildId: bigint, channelId: bigint) {
        let type = await db.execute(`
        SELECT channel_type
        FROM guild_channels
        WHERE guild_id = ? AND channel_id = ?
        `, [guildId, channelId]);

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

        await db.execute(`
        DELETE FROM guild_channels
        WHERE guild_id = ? AND channel_type = ?
        `, [guildId, type]);

        await db.execute(`
        INSERT INTO guild_channels VALUES(?, ?, ?)
        `, [guildId, channelId, type]);

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

        await db.execute(`
        UPDATE guild_channels
        SET channel_type = ?
        WHERE guild_id = ? AND channel_id = ?
        `, [type, guildId, channelId]);
    }

    static async removeChannel(guildId: bigint, channelId: bigint) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        guildChannels.delete(channelId);

        await db.execute(`
        DELETE FROM guild_channels
        WHERE guild_id = ? AND channel_id = ?
        `, [guildId, channelId]);
    }

    static async getPickupChannel(guildId: bigint) {
        const channel = await db.execute(`
        SELECT channel_id FROM guild_channels
        WHERE guild_id = ? AND channel_type = 'pickup'
        `, [guildId]);

        return channel[0][0].channel_id;
    }

    static async getAllExpires() {
        const expires = await db.query(`
        SELECT guild_id, player_id, expiration_date FROM state_active_expires
        `);

        return expires[0];
    }

    static async getAllAddTimes() {
        const addTimes = await db.query(`
        SELECT * FROM state_add_times
        `);

        return addTimes[0];
    }

    static async removeAddTimes(guildId: bigint, ...playerIds) {
        await db.execute(`
        DELETE FROM state_add_times
        WHERE guild_id = ?
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
        return;
    }

    static async getAllAos() {
        const aos = await db.query(`
        SELECT * FROM state_active_aos;
        `);

        return aos[0];
    }

    static async getAllAddedPlayers(guildId?: BigInt) {
        if (!guildId) {
            const players = await db.query(`
            SELECT guild_id, player_id FROM state_active_pickups
            `);

            return players[0];
        } else {
            const players = await db.execute(`
            SELECT player_id FROM state_active_pickups
            WHERE guild_id = ?
            `, [guildId]);

            return players[0].map(row => row.player_id);
        }
    }
}