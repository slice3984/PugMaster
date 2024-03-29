import Discord from 'discord.js';
import { Rating } from 'ts-trueskill';
import { ChannelType, PendingPickup } from '../core/types';
import GuildSettings from '../core/guildSettings';
import Bot from '../core/bot';
import db from '../core/db';
import { transaction } from '../core/db';
import { RowDataPacket } from 'mysql2';
import { PoolConnection } from 'mysql2/promise';

interface BannedPlayer {
    player: string;
    issuer: string;
    ends_at: Date;
    is_warn_ban: number;
    reason: string | null;
    id: number;
    banid: number;
}

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

    static async banGuild(guildId: bigint) {
        await db.execute(`
        INSERT INTO banned_guilds VALUES (?)
        `, [guildId]);
    }

    static async getGuildSettings(guild: Discord.Guild): Promise<GuildSettings> {
        const data = await transaction(db, async (db) => {
            let data: any = await db.execute(`
            SELECT * FROM guilds WHERE guild_id = ?
            `, [guild.id]);

            if (!data[0].length) {
                return null;
            }

            data = data[0][0];

            let guildChannels = await db.execute(`
            SELECT * FROM guild_channels
            WHERE guild_id = ?
            `, [guild.id]) as RowDataPacket[][];

            let commandSettingsResults = await db.execute(`
                SELECT command_name, value FROM guild_command_settings
                WHERE guild_id = ?
            `, [guild.id]) as RowDataPacket[][];

            const commandSettings = new Map();

            for (const row of commandSettingsResults[0]) {
                let value = Number.isInteger(+row.value) ? +row.value : row.value;
                if (!commandSettings.has(row.command_name)) {
                    commandSettings.set(row.command_name, [value]);
                } else {
                    commandSettings.get(row.command_name).push(value);
                }
            }

            const channels = new Map();

            guildChannels[0].forEach(channel => {
                channels.set(BigInt(channel.channel_id), channel.channel_type);
            });

            let disabledCommands = await GuildModel.getDisabledCommands(BigInt(guild.id));

            const settings = new GuildSettings(
                guild,
                BigInt(guild.id),
                data.prefix,
                data.global_denylist_role,
                data.global_allowlist_role,
                data.pickup_player_role,
                data.promotion_delay,
                data.last_promote,
                data.global_expire,
                data.report_expire,
                data.trust_time ? data.trust_time : null,
                data.explicit_trust ? data.explicit_trust : null,
                disabledCommands,
                commandSettings,
                channels,
                data.server_id,
                data.start_message,
                data.sub_message,
                data.notify_message,
                data.iteration_time,
                data.afk_time,
                data.afk_check_iterations,
                data.picking_iterations,
                data.map_vote_iterations,
                data.captain_selection_iterations,
                data.max_avg_elo_variance,
                data.max_rank_rating_cap,
                data.warn_streaks,
                data.warns_until_ban,
                data.warn_streak_expiration,
                data.warn_expiration_time,
                data.warn_ban_time,
                data.warn_ban_time_multiplier
            )

            return settings;
        });
        return data;
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

        await transaction(db, async (db) => {
            await db.execute(`
            DELETE FROM guild_channels
            WHERE guild_id = ? AND channel_type = ?
            `, [guildId, type]);

            await db.execute(`
            INSERT INTO guild_channels VALUES(?, ?, ?)
            `, [guildId, channelId, type]);
        });

        guildChannels.set(channelId, type);
    }

    static async updateChannel(guildId: bigint, channelId: bigint, type: ChannelType) {
        Bot.getInstance().getGuild(guildId).channels.set(channelId, type);

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

        if (channel[0][0]) {
            return channel[0][0].channel_id;
        } else {
            return null;
        }
    }

    static async getAllExpires(...guildIds) {
        let expires;

        if (guildIds.length === 0) {
            expires = await db.query(`
            SELECT guild_id, player_id, pickup_expire FROM state_guild_player
            WHERE pickup_expire IS NOT NULL
            `);
        } else {
            expires = await db.execute(`
            SELECT guild_id, player_id, pickup_expire FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND pickup_expire IS NOT NULL
            `, guildIds);
        }

        if (!expires[0].length) {
            return [];
        }

        return expires[0].map(expire => {
            return {
                ...expire,
                guild_id: expire.guild_id.toString(),
                player_id: expire.player_id.toString()
            }
        });
    }

    static async getAllAddTimes(...guildIds) {
        let addTimes;

        if (guildIds.length === 0) {
            addTimes = await db.query(`
            SELECT last_add, guild_id, player_id FROM state_guild_player
            WHERE last_add IS NOT NULL
            `);
        } else {
            addTimes = await db.execute(`
            SELECT last_add, guild_id, player_id FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND last_add IS NOT NULL
            `, [...guildIds])
        }

        if (!addTimes[0].length) {
            return [];
        }

        return addTimes[0].map(time => {
            return {
                ...time,
                guild_id: time.guild_id.toString(),
                player_id: time.player_id.toString()
            }
        });
    }

    static async removeAddTimes(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET last_add = null
        WHERE guild_id = ?
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
        return;
    }

    static async resetPlayerStates(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player 
        SET pickup_expire = null, pickup_expire = null, last_add = null, is_afk = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async clearUnusedPlayerStates() {
        await db.query(`
        DELETE FROM state_guild_player
        WHERE ao_expire IS NULL AND pickup_expire IS NULL AND sub_request IS NULL
        AND last_add IS NULL AND is_afk IS NULL
        `);
    }

    static async getAllAos(...guildIds) {
        let aos;

        if (guildIds.length === 0) {
            aos = await db.query(`
            SELECT guild_id, player_id, ao_expire FROM state_guild_player
            WHERE ao_expire IS NOT NULL
            `);
        } else {
            aos = await db.execute(`
            SELECT guild_id, player_id, ao_expire FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND ao_expire IS NOT NULL
            `, guildIds);
        }

        if (!aos[0].length) {
            return [];
        }

        return aos[0].map(ao => {
            return {
                ...ao,
                guild_id: ao.guild_id.toString(),
                player_id: ao.player_id.toString()
            }
        });
    }

    static async getAllAddedPlayers(excludePendingStage: boolean, guildId?: BigInt) {
        if (!guildId) {
            let players: any;

            if (excludePendingStage) {
                players = await db.query(`
                SELECT spp.guild_id, spp.player_id, sp.stage FROM state_pickup_players spp
                JOIN state_pickup sp ON spp.pickup_config_id = sp.pickup_config_id
                WHERE sp.stage NOT IN ('picking_manual', 'mapvote', 'captain_selection')
                `);
            } else {
                players = await db.query(`
                SELECT guild_id, player_id FROM state_pickup_players
                `);
            }

            if (!players[0].length) {
                return [];
            }

            return players[0].map(player => {
                return {
                    guild_id: player.guild_id.toString(),
                    player_id: player.player_id.toString()
                }
            });

        } else {
            let players: any;

            if (excludePendingStage) {
                players = await db.execute(`
                SELECT spp.guild_id, spp.player_id, sp.stage FROM state_pickup_players spp
                JOIN state_pickup sp ON spp.pickup_config_id = sp.pickup_config_id
                WHERE sp.stage NOT IN ('picking_manual', 'mapvote', 'captain_selection') AND spp.guild_id = ?
                `, [guildId]);
            } else {
                players = await db.execute(`
                SELECT player_id FROM state_pickup_players
                WHERE guild_id = ?
                `, [guildId]);
            }

            if (!players[0].length) {
                return []
            }

            return players[0].map(row => row.player_id.toString());
        }
    }

    static async modifyGuild(guildId: bigint, key: string, value: string) {
        let newValue: string | number = value;

        await db.execute(`
        UPDATE guilds SET ${key} = ?
        WHERE guild_id = ?
        `, [newValue, guildId]);
    }

    static async modifyCommand(guildId: bigint, settings: { command: string, values: [] }[]) {
        const commandNames = settings.map(obj => obj.command);
        const toInsert = [];

        settings.forEach(setting => {
            setting.values.forEach(value => {
                toInsert.push(guildId, setting.command, value);
            });
        });

        await transaction(db, async (db) => {
            // Delete possible already stored settings
            await db.execute(`
            DELETE FROM guild_command_settings WHERE guild_id = ?
            AND command_name IN (${Array(commandNames.length).fill('?').join(',')}) 
            `, [guildId, ...commandNames]);

            // Insert new settings
            await db.execute(`
            INSERT INTO guild_command_settings VALUES ${Array(toInsert.length / 3).fill('(?, ?, ?)').join(',')}
            `, [...toInsert]);
        });
    }

    static async disableCommand(guildId: bigint, ...commands) {
        await db.execute(`
        INSERT INTO guild_disabled_commands VALUES ${Array(commands.length).fill('(?, ?)').join(',')}
        `, [guildId, ...commands]);
    }

    static async getDisabledCommands(guildId: bigint) {
        const disabled = await db.execute(`
        SELECT command_name FROM guild_disabled_commands WHERE guild_id = ?
        `, [guildId]) as RowDataPacket[][];

        return disabled[0].map(row => row.command_name);
    }

    static async enableCommand(guildId: bigint, ...commands) {
        await db.execute(`
        DELETE FROM guild_disabled_commands WHERE guild_id = ?
        AND command_name IN (${Array(commands.length).fill('?').join(',')})
        `, [guildId, ...commands]);
    }

    static async getBans(guildId: bigint, mode: 'perms_only' | 'all' | 'timed', limit: number = 10): Promise<BannedPlayer[]> {
        let bans;

        switch (mode) {
            case 'perms_only':
                bans = await db.execute(`
                SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.is_warn_ban, b.reason, p.id, b.id AS banid FROM bans b
                JOIN players p ON b.player_id = p.id
                JOIN players p2 ON b.issuer_player_id = p2.id
                WHERE b.permanent = true AND b.is_active = true 
                AND b.guild_id = ? ORDER BY b.id LIMIT ${limit}
                `, [guildId]);
                break;
            case 'timed':
                bans = await db.execute(`
                SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.is_warn_ban, b.reason, p.id, b.id AS banid FROM bans b
                JOIN players p ON b.player_id = p.id
                JOIN players p2 ON b.issuer_player_id = p2.id
                WHERE b.ends_at > current_timestamp() AND b.is_active = true 
                AND b.guild_id = ? ORDER BY b.ends_at DESC LIMIT ${limit}
                `, [guildId]);
                break;
        }

        return bans[0] as BannedPlayer[];
    }

    static async getWarns(guildId: bigint, limit: number)
        : Promise<{ warns: number, player: string, issuer: string, warned_at: Date, reason: string, id: number, warnid: number }[]> {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        // https://mariadb.com/kb/en/why-is-order-by-in-a-from-subquery-ignored/
        const warns: any = await db.execute(`
        SELECT COUNT(w_temp.id) AS warns,
        w_temp.player,
        MAX(w_temp.issuer) AS issuer,
        MAX(w_temp.warned_at) AS warned_at,
        MAX(w_temp.reason) AS reason,
        w_temp.id, MAX(w_temp.warnid) AS warnid FROM (
            SELECT p.current_nick AS player, p2.current_nick AS issuer, w.warned_at, w.reason, p.id, w.id AS warnid FROM warns w
            JOIN players p ON w.player_id = p.id
            JOIN players p2 ON w.issuer_player_id = p2.id
            WHERE DATE_ADD(w.warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_TIMESTAMP
            AND w.guild_id = ? AND is_active = true
            ORDER BY w.warned_at DESC
            LIMIT 18446744073709551615) AS w_temp
        GROUP BY w_temp.id
        LIMIT ${limit}
        `, [guildSettings.warnExpiration, guildId]);

        return warns[0].reverse();
    }

    static async getPlayersWithNotify(guildId: bigint, ...playerIds): Promise<string[]> {
        const playersWithNotify: any = await db.execute(`
        SELECT user_id FROM players
        WHERE notifications = true
        AND guild_id = ?
        AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);

        return playersWithNotify[0].map(player => player.user_id.toString());
    }

    static async updateLastPromote(guildId: bigint) {
        await db.execute(`
        UPDATE guilds SET last_promote = CURRENT_TIMESTAMP
        WHERE guild_id = ?
        `, [guildId]);
    }

    static async getPendingPickup(guildId: bigint, pickupConfigId: number): Promise<PendingPickup> {
        const data: any = await db.execute(`
		SELECT sp.guild_id, p.current_nick, p.user_id, pr.rating, pr.variance, pc.id, pc.name, pc.player_count, sp.in_stage_since, sp.stage_iteration, sp.stage
        FROM state_pickup sp
        JOIN state_pickup_players spp ON spp.pickup_config_id = sp.pickup_config_id
        JOIN players p ON p.user_id = spp.player_id AND p.guild_id = spp.guild_id
        JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
        LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pc.id = pr.pickup_config_id
        WHERE sp.stage != 'fill' AND sp.guild_id = ? AND pc.id = ?
        `, [guildId, pickupConfigId]);

        if (!data[0].length) {
            return null;
        }

        let amountPlayersAdded = 0;
        const players = [];

        data[0].forEach(row => {
            players.push({
                id: row.user_id.toString(),
                nick: row.current_nick,
                rating: row.rating ? new Rating(row.rating, row.variance) : new Rating(),
            });

            amountPlayersAdded++;
        });

        return {
            pickupConfigId: data[0][0].id,
            name: data[0][0].name,
            maxPlayers: data[0][0].player_count,
            players,
            amountPlayersAdded,
            pendingSince: data[0][0].in_stage_since,
            currentIteration: data[0][0].stage_iteration,
            stage: data[0][0].stage,
        }
    }

    static async getGuildsWithPendingPickups(...guildIds: bigint[]): Promise<string[]> {
        const data: any = await db.execute(`
        SELECT DISTINCT sp.guild_id FROM state_pickup sp
	    WHERE sp.stage != 'fill' AND sp.guild_id IN (${Array(guildIds.length).fill('?').join(',')})
        `, guildIds);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => row.guild_id);
    }

    static async getPendingPickups(...guildIds: bigint[]): Promise<Map<string, PendingPickup[]>> {
        const data: any = await db.execute(`
        SELECT sp.guild_id, p.current_nick, p.user_id, pc.id, pc.name, pc.player_count, sp.in_stage_since, sp.stage_iteration, sp.stage
        FROM state_pickup sp
        JOIN state_pickup_players spp ON spp.pickup_config_id = sp.pickup_config_id
        JOIN players p ON p.user_id = spp.player_id AND p.guild_id = spp.guild_id
        JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
        WHERE sp.guild_id IN (${Array(guildIds.length).fill('?').join(',')})
        AND sp.stage != 'fill'
        ORDER BY sp.in_stage_since
        `, guildIds);

        if (!data[0].length) {
            return null;
        }

        const guilds = new Map();

        data[0].forEach(row => {
            const guildId = row.guild_id.toString();

            if (!guilds.has(guildId)) {
                guilds.set(guildId, [{
                    pickupConfigId: row.id,
                    name: row.name,
                    maxPlayers: row.player_count,
                    amountPlayersAdded: 0,
                    pendingSince: row.in_stage_since,
                    currentIteration: row.stage_iteration,
                    stage: row.stage,
                    players: []
                }]);
            }

            const guildRef = guilds.get(guildId);
            let pickupIndex = guildRef.findIndex(pickup => pickup.pickupConfigId === row.id);

            if (pickupIndex < 0) {
                guildRef.push({
                    pickupConfigId: row.id,
                    name: row.name,
                    maxPlayers: row.player_count,
                    amountPlayersAdded: 0,
                    pendingSince: row.in_stage_since,
                    currentIteration: row.stage_iteration,
                    stage: row.stage,
                    players: []
                });
                pickupIndex = guildRef.length - 1;
            }

            const pickup = guildRef[pickupIndex];

            const playerObj = {
                id: row.user_id.toString(),
                nick: row.current_nick,
                rating: row.rating ? new Rating(row.rating, row.variance) : new Rating(),
            };

            pickup.players.push(playerObj);
            pickup.amountPlayersAdded++;
        });

        return guilds;
    }

    static async setAfks(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET is_afk = true
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async removeAfks(connection: PoolConnection, guildId: bigint, ...playerIds) {
        const conn = db || connection;

        await conn.execute(`
        UPDATE state_guild_player SET is_afk = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async getAfks(guildId: bigint, ...playerIds): Promise<string[]> {
        const data: any = await db.execute(`
        SELECT player_id FROM state_guild_player
        WHERE guild_id = ? AND is_afk IS NOT NULL
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);

        return data[0].map(row => row.player_id.toString());
    }

    static async resetState(guildId: bigint) {
        await transaction(db, async (db) => {
            // Pickup
            await db.execute(`
            DELETE FROM state_pickup WHERE guild_id = ?
            `, [guildId]);

            // Pickup players
            await db.execute(`
            DELETE FROM state_pickup_players WHERE guild_id = ?
            `, [guildId]);

            // Guild players
            await db.execute(`
            DELETE FROM state_guild_player WHERE guild_id = ?
            `, [guildId]);
        });
    }

    static async clearPendingPickups() {
        // Clear states
        await transaction(db, async (db) => {
            // Pickup states
            await db.execute(`
            DELETE FROM state_pickup sp WHERE sp.stage != 'fill'
            `);

            // Pickup players
            await db.execute(`
            DELETE spp FROM state_pickup_players spp
            LEFT JOIN state_pickup sp ON sp.pickup_config_id = spp.pickup_config_id
            WHERE sp.pickup_config_id IS NULL
            `);

            // Guild players
            await db.execute(`
            DELETE sgp FROM state_guild_player sgp
            LEFT JOIN state_pickup_players spp ON spp.guild_id = sgp.guild_id AND spp.player_id = sgp.player_id
            WHERE spp.guild_id IS NULL
            `)

            // Left states
            await db.execute(`
            UPDATE state_guild_player SET is_afk = NULL, sub_request = NULL 
            `)
        });
    }

    static async getStateReportTimes(): Promise<Map<string, { start: Date, pickupId: number }[]> | null> {
        const data: any = await db.query(`
        SELECT p.guild_id, p.id, p.started_at FROM pickups p
        JOIN state_rating_reports srr ON srr.pickup_id = p.id
        GROUP BY p.id
        `);

        if (!data[0].length) {
            return null;
        }

        const reports = new Map();

        data[0].forEach(row => {
            const guildId = row.guild_id;

            if (!reports.has(guildId)) {
                reports.set(guildId, [{ start: row.started_at, pickupId: row.id }]);
            } else {
                reports.get(guildId).push({ start: row.started_at, pickupId: row.id });
            }
        });

        return reports;
    }

    static async clearStateReports(pickupsToClear: number[], activeGuilds: bigint[]) {
        await db.execute(`
        DELETE srr FROM state_rating_reports srr
        JOIN pickups p ON srr.pickup_id = p.id
        WHERE pickup_id IN (${Array(pickupsToClear.length).fill('?').join(',')})
        OR guild_id NOT IN (${Array(activeGuilds.length).fill('?').join(',')})
        `, [...pickupsToClear, ...activeGuilds])
    }

    static async clearSubRequestsForPlayer(guildId: bigint, playerId: bigint) {
        await db.execute(`
        UPDATE state_guild_player SET sub_request = NULL
        WHERE guild_id = ? AND sub_request = ?
        `, [guildId, playerId]);
    }

    static async clearSubRequests(...guildIds) {
        await db.execute(`
        UPDATE state_guild_player SET sub_request = NULL
        WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
        `, guildIds);
    }

    static async resetRatings(guildId: bigint, ...pickupConfigIds) {
        await transaction(db, async (db) => {
            const conn = db as PoolConnection;

            // Rated results
            await conn.execute(`
            DELETE rr.* FROM rated_results rr
            JOIN pickups p ON rr.pickup_id = p.id
			WHERE p.is_rated = 1 AND p.guild_id = ? AND p.pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
            `, [guildId, ...pickupConfigIds]);

            // Pickups
            await conn.execute(`
            UPDATE pickups SET is_rated = 0
            WHERE guild_id = ? AND pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
            `, [guildId, ...pickupConfigIds]);

            // Player rating history
            await conn.execute(`
            UPDATE pickup_players pp
            JOIN pickups ps ON ps.id = pp.pickup_id
            SET pp.rating = null, pp.variance = null
            WHERE ps.guild_id = ? AND ps.pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
            `, [guildId, ...pickupConfigIds]);

            // Player rating snapshots
            await conn.execute(`
            DELETE FROM player_ratings
            WHERE pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
            `, pickupConfigIds);
        });
    }
}