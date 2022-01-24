import * as ts from 'ts-trueskill';
import { ActivePickup, PickupSettings, RateablePickup } from '../core/types';
import db from '../core/db';
import { transaction } from '../core/db';
import { PoolConnection } from 'mysql2/promise';
import GuildModel from './guild';

export default class PickupModel {
    private constructor() { }

    static async areValidPickups(guildId: bigint, onlyEnabled: boolean, ...pickups): Promise<{ name: string; id: number }[]> {
        let results;

        if (onlyEnabled) {
            results = await db.execute(`
            SELECT name, id FROM pickup_configs
            WHERE guild_id = ? AND BINARY name IN (${Array(pickups.length).fill('?').join(',')}) AND is_enabled = 1
            `, [guildId, ...pickups])
        } else {
            results = await db.execute(`
            SELECT name, id FROM pickup_configs
            WHERE guild_id = ? AND BINARY name IN (${Array(pickups.length).fill('?').join(',')})
            `, [guildId, ...pickups])
        }


        return results[0];
    }

    static async createPickups(guildId: bigint, ...pickups: { name: string; playerCount: number, teamCount?: number }[]) {
        for (const pickup of pickups) {
            await db.execute(`
            INSERT INTO pickup_configs 
            (guild_id, name, player_count, team_count)
            VALUES (?, ?, ?, IFNULL(?,DEFAULT(team_count)))
            `, [guildId, pickup.name, pickup.playerCount, pickup.teamCount || null]);
        }
        return;
    }

    static async removePickups(guildId: bigint, ...pickupConfigIds) {
        await db.execute(`
        DELETE FROM pickup_configs
        WHERE guild_id = ? AND id IN (${Array(pickupConfigIds.length).fill('?').join(',')}) 
        `, [guildId, ...pickupConfigIds]);
    }

    static async getActivePickup(guildId: bigint, nameOrConfigId: number | string):
        Promise<ActivePickup> {
        let result;

        if (typeof nameOrConfigId === 'number') {
            result = await db.execute(`
			SELECT c.id, c.name, s.player_id, c.player_count, c.team_count, p.current_nick, pr.rating, pr.variance FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id AND p.guild_id = s.guild_id
            LEFT JOIN player_ratings pr ON pr.player_id = p.id AND c.id = pr.pickup_config_id
            WHERE c.guild_id = ? AND c.id = ?;
            `, [guildId, nameOrConfigId]);
        } else {
            result = await db.execute(`
			SELECT c.id, c.name, s.player_id, c.player_count, c.team_count, p.current_nick, pr.rating, pr.variance FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id AND p.guild_id = s.guild_id
            LEFT JOIN player_ratings pr ON pr.player_id = p.id AND c.id = pr.pickup_config_id
            WHERE c.guild_id = ? AND c.name = ?;
            `, [guildId, nameOrConfigId]);
        }

        if (!result[0].length) {
            return;
        }

        const players = [];

        for (const row of result[0]) {
            players.push({
                id: row.player_id.toString(),
                nick: row.current_nick,
                rating: row.rating ? new ts.Rating(row.rating, row.variance) : new ts.Rating()
            });
        }

        return {
            name: result[0][0].name,
            players,
            maxPlayers: result[0][0].player_count,
            teams: result[0][0].team_count,
            configId: result[0][0].id
        }
    }

    static async getActivePickups(guildId: bigint, includingDefaults = false): Promise<Map<string,
        { name: string, players: { id: string | null, nick: string | null }[]; maxPlayers: number; configId: number }>> {
        let result;

        if (!includingDefaults) {
            result = await db.execute(`
            SELECT c.guild_id, c.id, c.name, player_id, c.player_count, p.current_nick FROM state_pickup_players spp
            JOIN pickup_configs c ON spp.pickup_config_id = c.id
            JOIN players p ON p.user_id = spp.player_id AND p.guild_id = spp.guild_id 
            WHERE spp.guild_id = ? AND c.is_enabled = 1
            `, [guildId]);
        } else {
            result = await db.execute(`
			SELECT c.guild_id, c.id, c.name, s.player_id, c.player_count, p.current_nick FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id AND s.guild_id = c.guild_id
            LEFT JOIN players p on p.user_id = s.player_id AND p.guild_id = c.guild_id
            WHERE c.guild_id = ? AND (s.player_id IS NOT NULL OR c.is_default_pickup = true) AND c.is_enabled = 1
            `, [guildId]);
        }
        const pickups = new Map();

        for (const row of result[0]) {
            if (!pickups.has(row.name)) {
                pickups.set(row.name, { name: row.name, players: [{ id: row.player_id ? row.player_id.toString() : null, nick: row.current_nick }], maxPlayers: row.player_count, configId: row.id });
                continue;
            }
            pickups.get(row.name).players.push({ id: row.player_id ? row.player_id.toString() : null, nick: row.current_nick });
        }

        return pickups;
    }

    static async getAllPickups(guildId: bigint, includeDisabled: boolean = false):
        Promise<{ id: number, name: string, enabled: boolean, rated: boolean, added: number, max: number }[]> {
        let results;

        if (includeDisabled) {
            results = await db.execute(`
            SELECT pc.id, pc.name, pc.is_enabled, pc.is_rated, COUNT(sp.player_id) as added, pc.player_count FROM state_pickup_players sp
            RIGHT JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
            WHERE pc.guild_id = ?
            GROUP BY pc.id ORDER BY added DESC, pc.player_count DESC;
            `, [guildId]);
        } else {
            results = await db.execute(`
            SELECT pc.id, pc.name, pc.is_enabled, pc.is_rated, COUNT(sp.player_id) as added, pc.player_count FROM state_pickup_players sp
            RIGHT JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
            WHERE pc.guild_id = ? AND pc.is_enabled = 1
            GROUP BY pc.id ORDER BY added DESC, pc.player_count DESC;
            `, [guildId]);
        }

        const pickups = [];

        results[0].forEach(row => {
            pickups.push({
                id: row.id,
                name: row.name,
                enabled: Boolean(row.is_enabled),
                rated: Boolean(row.is_rated),
                added: row.added,
                max: row.player_count
            });
        });

        return pickups;
    }

    static async getSortedEnabledPickups(guildId: bigint):
        Promise<{
            pickupConfigId: number;
            name: string;
            rated: boolean;
            gotPromotionRole: boolean;
            gotCaptainRole: boolean;
            amount: number;
            playerCount: number

        }[]> {
        const results = [];

        const data: any = await db.execute(`
        SELECT pc.id, pc.name, pc.is_enabled, pc.is_rated, pc.promotion_role, pc.captain_role, COUNT(p.id) as amount, pc.player_count FROM pickups p
        RIGHT JOIN pickup_configs pc ON p.pickup_config_id = pc.id
        WHERE pc.guild_id = ? AND pc.is_enabled = 1
        GROUP BY pc.id ORDER BY amount DESC 
        `, [guildId]);

        data[0].forEach(row => {
            results.push({
                pickupConfigId: row.id,
                name: row.name,
                rated: Boolean(row.is_rated),
                gotPromotionRole: Boolean(row.promotion_role),
                gotCaptainRole: Boolean(row.captain_role),
                amount: row.amount,
                playerCount: row.player_count
            });
        });

        return results;
    }

    static async getAddedPlayers() {
        const players: any = await db.query(`
        SELECT player_id, guild_id FROM state_pickup_players
        `);

        if (!players[0].length) {
            return [];
        }

        return players[0].map(player => {
            return {
                player_id: player.player_id.toString(),
                guild_id: player.guild_id.toString()
            }
        })
    }

    static async getStoredPickupCount(guildId: bigint) {
        const count = await db.execute(`
        SELECT COUNT(*) AS cnt FROM pickup_configs
        WHERE guild_id = ? AND is_enabled = 1
        `, [guildId]);

        return count[0][0].cnt;
    }

    static async isPlayerAdded(guildId: bigint, playerId: bigint, ...pickupConfigIds): Promise<number[]> {
        if (pickupConfigIds.length === 0) {
            const result: any = await db.execute(`
            SELECT pickup_config_id FROM state_pickup_players
            WHERE guild_id = ? AND player_id = ?
            `, [guildId, playerId]);
            return result[0].map(row => row.pickup_config_id);
        }
        const result: any = await db.execute(`
        SELECT pickup_config_id FROM state_pickup_players
        WHERE guild_id = ? AND player_id = ?
        AND pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
        `, [guildId, playerId, ...pickupConfigIds]);

        return result[0].map(row => row.pickup_config_id);
    }

    static async addPlayer(guildId: bigint, playerId: bigint, ...pickupConfigIds) {
        let valueStrings = [];
        let pickups = [];

        pickupConfigIds.forEach(id => {
            valueStrings.push(`(${guildId}, ${playerId}, ${id})`)
            pickups.push(`(${guildId}, ${id})`);
        });

        await transaction(db, async (db) => {
            const conn = db as PoolConnection;

            // Update add time
            await this.updatePlayerAddTime(conn, guildId, playerId);

            // Update state pickup
            await conn.query(`
            INSERT IGNORE INTO state_pickup (guild_id, pickup_config_id)
            VALUES ${pickups.join(', ')}
            `);

            // Insert pickup player
            await conn.query(`
            INSERT state_pickup_players
            VALUES ${valueStrings.join(', ')}
            `);
        });
    }

    static async removePlayers(guildId: bigint, ...playerIds) {
        await transaction(db, async (db) => {
            await db.execute(`
            DELETE FROM state_pickup_players
            WHERE guild_id = ?
            AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
            `, [guildId, ...playerIds]);

            await db.execute(`
            DELETE FROM state_pickup
            WHERE pickup_config_id NOT IN (SELECT DISTINCT pickup_config_id FROM state_pickup_players WHERE guild_id = ?)
            AND guild_id = ?
            `, [guildId, guildId]);
        });
    }

    static async clearPickupPlayers(guildId: bigint, pickupConfigId: number, connection?: PoolConnection) {
        const conn = connection || db;

        await transaction(conn, async (db) => {
            // Remove players
            await db.execute(`
            DELETE FROM state_pickup_players
            WHERE guild_id = ? AND pickup_config_id = ?
            `, [guildId, pickupConfigId]);

            // Remove pickup
            await db.execute(`
            DELETE FROM state_pickup
            WHERE guild_id = ? AND pickup_config_id = ?
            `, [guildId, pickupConfigId]);
        });
    }

    static async removePlayersExclude(guildId: bigint, excludedPickups: number[], ...playerIds) {
        await transaction(db, async (db) => {
            await db.execute(`
            DELETE FROM state_pickup_players
            WHERE guild_id = ?
            AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
            AND pickup_config_id NOT IN (${Array(excludedPickups.length).fill('?').join(',')})
            `, [guildId, ...playerIds, ...excludedPickups]);

            await db.execute(`
            DELETE FROM state_pickup
            WHERE pickup_config_id NOT IN (SELECT DISTINCT pickup_config_id FROM state_pickup_players WHERE guild_id = ?)
            AND guild_id = ?
            `, [guildId, guildId]);
        });
    }

    static async removePlayer(connection: PoolConnection | null = null, guildId: bigint, playerId: bigint, ...pickupConfigIds) {
        const conn = connection || db;

        await transaction(conn, async (db) => {
            if (pickupConfigIds.length === 0) {
                await db.execute(`
                DELETE FROM state_pickup_players
                WHERE guild_id = ? AND player_id = ?
                `, [guildId, playerId]);
            } else {
                await db.execute(`
                DELETE FROM state_pickup_players
                WHERE guild_id = ? AND player_id = ?
                AND pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
                `, [guildId, playerId, ...pickupConfigIds]);
            }

            // Maybe need to find a better solution for this
            await db.execute(`
            DELETE FROM state_pickup
            WHERE pickup_config_id NOT IN (SELECT DISTINCT pickup_config_id FROM state_pickup_players WHERE guild_id = ?)
            AND guild_id = ?
            `, [guildId, guildId]);
        });
    }

    static async updatePlayerAddTime(connection: PoolConnection, guildId: bigint, playerId: bigint) {
        const conn = connection || db;

        await conn.execute(`
        INSERT INTO state_guild_player (guild_id, player_id, last_add)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE last_add = CURRENT_TIMESTAMP
        `, [guildId, playerId]);
        return;
    }

    static async updatePlayerAddTimes(guildId: bigint, ...playerIds) {
        let playerValues = [];

        playerIds.forEach(id => {
            playerValues.push(`(${guildId}, ${id}, CURRENT_TIMESTAMP)`);
        });

        await db.execute(`
        INSERT INTO state_guild_player (guild_id, player_id, last_add)
        VALUES ${playerValues.join(', ')}
        ON DUPLICATE KEY UPDATE last_add = CURRENT_TIMESTAMP
        `);
    }

    static async getPickupSettings(guildId: BigInt, pickup: number | string, excludeDisabled: boolean = false): Promise<PickupSettings> {
        let settings;

        if (typeof pickup === 'number') {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND id  = ?${excludeDisabled ? ' AND is_enabled = 1' : ''}
            `, [guildId, pickup]);
        } else {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND name = ?${excludeDisabled ? ' AND is_enabled = 1' : ''}
            `, [guildId, pickup]);
        }

        if (!settings[0].length) {
            return null;
        }

        settings = settings[0][0];

        return {
            id: settings.id,
            name: settings.name,
            enabled: Boolean(settings.is_enabled),
            playerCount: settings.player_count,
            teamCount: settings.team_count,
            isDefaultPickup: Boolean(settings.is_default_pickup),
            mapPoolId: settings.mappool_id ? settings.mappool_id : null,
            mapvote: Boolean(settings.map_vote),
            afkCheck: Boolean(settings.afk_check),
            captainSelection: settings.captain_selection,
            pickMode: settings.pick_mode,
            rated: Boolean(settings.is_rated),
            maxRankRatingCap: settings.max_rank_rating_cap ? settings.max_rank_rating_cap : null,
            allowlistRole: settings.allowlist_role ? settings.allowlist_role.toString() : null,
            denylistRole: settings.denylist_role ? settings.denylist_role.toString() : null,
            promotionRole: settings.promotion_role ? settings.promotion_role.toString() : null,
            captainRole: settings.captain_role ? settings.captain_role.toString() : null,
            serverId: settings.server_id ? settings.server_id : null
        }
    }

    static async getMultiplePickupSettings(guildId: BigInt, ...pickups): Promise<PickupSettings[]> {
        let settings;

        if (typeof pickups[0] === 'number') {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND id IN (${Array(pickups.length).fill('?').join(',')})
            `, [guildId, ...pickups]);
        } else {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND name IN (${Array(pickups.length).fill('?').join(',')})
            `, [guildId, ...pickups]);
        }

        settings = settings[0];

        const results = [];

        settings.forEach(settings => results.push({
            id: settings.id,
            name: settings.name,
            playerCount: settings.player_count,
            teamCount: settings.team_count,
            isDefaultPickup: Boolean(settings.is_default_pickup),
            mapPoolId: settings.mappool_id ? settings.mappool_id : null,
            afkCheck: Boolean(settings.afk_check),
            pickMode: settings.pick_mode,
            allowlistRole: settings.allowlist_role ? settings.allowlist_role.toString() : null,
            denylistRole: settings.denylist_role ? settings.denylist_role.toString() : null,
            promotionRole: settings.promotion_role ? settings.promotion_role.toString() : null,
            captainRole: settings.captain_role ? settings.captain_role.toString() : null,
            serverId: settings.server_id ? settings.server_id : null
        }));

        return results;
    }

    static async modifyPickup(guildId: bigint, pickup: number | string, key: string, value: string) {
        let newValue: string | number = value;

        if (value === 'true') {
            newValue = 1;
        } else if (value === 'false') {
            newValue = 0;
        }

        if (typeof pickup === 'number') {
            await db.execute(`
            UPDATE pickup_configs SET ${key} = ?
            WHERE guild_id = ? AND id = ?
            `, [newValue, guildId, pickup]);
        } else {
            await db.execute(`
            UPDATE pickup_configs SET ${key} = ?
            WHERE guild_id = ? AND name = ?
            `, [newValue, guildId, pickup]);
        }
    }

    static async setPending(guildId: bigint, pickupConfigId: number, stage: 'afk_check' | 'mapvote' | 'captain_selection' | 'picking_manual' | 'fill', connection?: PoolConnection) {
        const conn = connection || db;

        await conn.execute(`
        UPDATE state_pickup SET stage = ?, in_stage_since = CURRENT_TIMESTAMP, stage_iteration = 0
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [stage, guildId, pickupConfigId]);
    }

    static async setPendings(connection: PoolConnection, guildId: bigint, stage: 'afk_check' | 'mapvote' | 'picking_manual' | 'fill', ...pickupConfigIds) {
        const conn = connection || db;

        await conn.execute(`
        UPDATE state_pickup SET stage = ?, in_stage_since = CURRENT_TIMESTAMP, stage_iteration = 0
        WHERE guild_id = ? AND pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
        `, [stage, guildId, ...pickupConfigIds]);
    }

    static async incrementPendingIteration(guildId: BigInt, pickupConfigId: number) {
        await db.execute(`
        UPDATE state_pickup SET stage_iteration = stage_iteration + 1
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [guildId, pickupConfigId]);
    }

    static async resetPendingIteration(guildId: BigInt, pickupConfigId: number) {
        await db.execute(`
        UPDATE state_pickup SET stage_iteration = 0
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [guildId, pickupConfigId]);
    }

    static async isInStage(guildId: bigint, pickupConfigId: number, stage: 'afk_check' | 'picking_manual' | 'fill') {
        const inStage = await db.execute(`
        SELECT COUNT(*) as pending FROM state_pickup
        WHERE guild_id = ? AND pickup_config_id = ? AND stage = ?
        `, [guildId, pickupConfigId, stage]);

        return inStage[0][0].pending;
    }

    static async playedBefore(guildId: bigint, playerId: BigInt):
        Promise<boolean> {
        const playedBefore: any = await db.execute(`
        SELECT 1 as played FROM pickup_players pp
        JOIN players ps ON pp.player_id = ps.id
        WHERE ps.guild_id = ? AND ps.user_id = ?
        LIMIT 1
        `, [guildId, playerId]);

        if (!playedBefore[0].length) {
            return false;
        } else {
            return true;
        }
    }

    static async isPlayerAddedToPendingPickup(guildId: bigint, playerId: bigint, ...stage: ('fill' | 'afk_check' | 'picking_manual' | 'mapvote' | 'captain_selection')[]):
        Promise<boolean> {
        const data: any = await db.execute(`
        SELECT * FROM state_pickup sp
        JOIN state_pickup_players spp ON sp.pickup_config_id = spp.pickup_config_id
        WHERE sp.stage IN (${Array(stage.length).fill('?').join(',')}) AND sp.guild_id = ? AND spp.player_id = ?
        LIMIT 1
        `, [...stage, guildId, playerId]);

        if (!data[0].length) {
            return false;
        }

        return true;
    }

    // Used when a sql error occurs or transaction fails
    static async resetPickup(guildId: bigint, pickupConfigId: number) {
        await transaction(db, async (conn) => {
            const db = conn as PoolConnection;

            await this.clearPickupPlayers(guildId, pickupConfigId, db);

            // Clear player states if necessary
            await db.execute(`
            UPDATE state_guild_player
            SET pickup_expire = null, last_add = null, is_afk = null
            WHERE guild_id = ? 
            AND player_id NOT IN (SELECT DISTINCT player_id FROM state_pickup_players WHERE guild_id = ?)
            `, [guildId, guildId]);
        });
    }

    static async abortPendingPickingPickup(guildId: bigint, pickupConfigId: number, playerId: bigint) {
        await transaction(db, async (conn) => {
            const c = conn as PoolConnection;
            await this.setPending(guildId, pickupConfigId, 'fill', c);
            await this.removePlayer(c, guildId, playerId, pickupConfigId);
        });
    }

    static async abortAfkCheck(guildId: bigint, pickupConfigId: number) {
        await PickupModel.setPending(guildId, pickupConfigId, 'fill', null);
    }

    static async clearPendingAfkPickupStates(guildId: bigint, addedPlayerIds: bigint[], pickupConfigIds: number[]) {
        await transaction(db, async (db) => {
            const conn = db as PoolConnection;

            await GuildModel.removeAfks(conn, guildId, ...addedPlayerIds);
            await this.setPendings(conn, guildId, 'fill', ...pickupConfigIds);
        });
    }
    static async getLatestStoredRateEnabledPickup(guildId: bigint, playerId?: bigint, puId?: number): Promise<RateablePickup | null> {
        let data: any;

        if (playerId) {
            if (puId) {
                data = await db.execute(`
                SELECT pc.id AS pickupConfigId, pc.name, ps.id AS pickupId, ps.started_at, pp.team, t.name AS team_alias, p.user_id, pr.rating, p.current_nick, pp.is_captain, rr.result FROM pickup_configs pc
                JOIN pickups ps ON ps.pickup_config_id = pc.id
                JOIN pickup_players pp ON ps.id = pp.pickup_id
                LEFT JOIN rated_results rr ON rr.pickup_id = ps.id AND rr.team = pp.team
                LEFT JOIN teams t ON t.guild_id = pc.guild_id AND t.team_id = pp.team
                JOIN players p ON p.id = pp.player_id
                LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.pickup_config_id = pc.id
                WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1
                AND ps.id = (SELECT MAX(p.id) FROM pickups p
                            JOIN pickup_configs pc ON pc.id = p.pickup_config_id
                            JOIN pickup_players pp ON p.id = pp.pickup_id
                            JOIN players ps ON ps.id = pp.player_id
                            WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1 AND p.has_teams = 1 AND ps.user_id = ? AND p.id = ?)
                `, [guildId, guildId, playerId, puId]);
            } else {
                data = await db.execute(`
                SELECT pc.id AS pickupConfigId, pc.name, ps.id AS pickupId, ps.started_at, pp.team, t.name AS team_alias, p.user_id, pr.rating, p.current_nick, pp.is_captain, rr.result FROM pickup_configs pc
                JOIN pickups ps ON ps.pickup_config_id = pc.id
                JOIN pickup_players pp ON ps.id = pp.pickup_id
                LEFT JOIN rated_results rr ON rr.pickup_id = ps.id AND rr.team = pp.team
                LEFT JOIN teams t ON t.guild_id = pc.guild_id AND t.team_id = pp.team
                JOIN players p ON p.id = pp.player_id
                LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.pickup_config_id = pc.id
                WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1
                AND ps.id = (SELECT MAX(p.id) FROM pickups p
                            JOIN pickup_configs pc ON pc.id = p.pickup_config_id
                            JOIN pickup_players pp ON p.id = pp.pickup_id
                            JOIN players ps ON ps.id = pp.player_id
                            WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1 AND p.has_teams = 1 AND ps.user_id = ?)
                `, [guildId, guildId, playerId]);
            }
        } else {
            data = await db.execute(`
            SELECT pc.id AS pickupConfigId, pc.name, ps.id AS pickupId, ps.started_at, pp.team, t.name AS team_alias, p.user_id, pr.rating, p.current_nick, pp.is_captain, rr.result FROM pickup_configs pc
            JOIN pickups ps ON ps.pickup_config_id = pc.id
            JOIN pickup_players pp ON ps.id = pp.pickup_id
            LEFT JOIN rated_results rr ON rr.pickup_id = ps.id AND rr.team = pp.team
            LEFT JOIN teams t ON t.guild_id = pc.guild_id AND t.team_id = pp.team 
            JOIN players p ON p.id = pp.player_id
            LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.pickup_config_id = pc.id
            WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1
            AND ps.id = (SELECT MAX(p.id) FROM pickups p
                        JOIN pickup_configs pc ON pc.id = p.pickup_config_id
                        WHERE pc.guild_id = ? AND pc.is_rated = 1 AND pc.is_enabled = 1 AND p.has_teams = 1)
            `, [guildId, guildId]);
        }

        if (!data[0].length) {
            return null;
        }

        let pickupId: number;
        let pickupConfigId: number;
        let name: string;
        let startedAt: Date;
        let isRated: boolean;
        let captains = [];
        const teams = new Map();

        data[0].forEach((row, index) => {
            if (!index) {
                pickupId = row.pickupId;
                pickupConfigId = row.pickupConfigId;
                name = row.name;
                startedAt = row.started_at;
                isRated = row.result !== null ? true : false;
            }

            if (row.is_captain) {
                captains.push({ team: row.team, alias: row.team_alias, id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }

            const team = teams.get(row.team);

            if (!team) {
                teams.set(row.team, {
                    name: row.team,
                    alias: row.team_alias,
                    outcome: row.result,
                    players: [{ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick }]
                });
            } else {
                team.players.push({ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }
        });

        return {
            pickupId,
            pickupConfigId,
            name,
            startedAt,
            isRated,
            captains,
            teams: Array.from(teams.values())
        } as unknown as RateablePickup;
    }

    static async getStoredRateEnabledPickup(guildId: bigint, puId: number): Promise<RateablePickup | null> {
        const data: any = await db.execute(`
		SELECT pc.id AS pickupConfigId, pc.name, ps.id AS pickupId, ps.started_at, pp.team, t.name AS team_alias, p.user_id, pr.rating, p.current_nick, pp.is_captain, rr.result FROM pickup_configs pc
        JOIN pickups ps ON ps.pickup_config_id = pc.id
        JOIN pickup_players pp ON ps.id = pp.pickup_id
        LEFT JOIN rated_results rr ON rr.pickup_id = ps.id AND rr.team = pp.team
        LEFT JOIN teams t ON t.guild_id = pc.guild_id AND t.team_id = pp.team
        JOIN players p ON p.id = pp.player_id
        LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pc.id = pr.pickup_config_id
        WHERE pc.guild_id = ? AND ps.id = ? AND pc.is_rated = 1
        `, [guildId, puId]);

        if (!data[0].length) {
            return null;
        }

        let pickupId: number;
        let pickupConfigId: number;
        let name: string;
        let startedAt: Date;
        let isRated: boolean;
        let captains = [];
        const teams = new Map();

        data[0].forEach((row, index) => {
            if (!index) {
                pickupId = row.pickupId;
                pickupConfigId = row.pickupConfigId;
                name = row.name;
                startedAt = row.started_at;
                isRated = row.result !== null ? true : false;
            }

            if (row.is_captain) {
                captains.push({ team: row.team, alias: row.team_alias, id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }

            const team = teams.get(row.team);

            if (!team) {
                teams.set(row.team, {
                    name: row.team,
                    alias: row.team_alias,
                    outcome: row.result,
                    players: [{ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick }]
                });
            } else {
                team.players.push({ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }
        });

        return {
            pickupId,
            pickupConfigId,
            name,
            startedAt,
            isRated,
            captains,
            teams: Array.from(teams.values())
        } as unknown as RateablePickup;
    }

    static async reportOutcome(pickupId: number, team: string, outcome: 'loss' | 'draw') {
        await db.execute(`
        INSERT INTO state_rating_reports VALUES (?, ?, ?)
        `, [pickupId, team, outcome]);
    }

    static async getReportedOutcomes(pickupId: number):
        Promise<{ team: string; outcome: 'loss' | 'draw' | 'win' }[] | null> {
        const data: any = await db.execute(`
        SELECT * FROM state_rating_reports WHERE pickup_id = ?
        `, [pickupId]);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => {
            return {
                team: row.team,
                outcome: row.outcome
            }
        });
    }

    static async getPickupRatings(pickupId: number):
        Promise<{ captain: { id: string; nick: string }; reported: 'draw' | 'loss' | 'win' | null }[]> {
        const data: any = await db.execute(`
        SELECT ps.user_id, ps.current_nick, rr.result FROM pickup_players p
        JOIN players ps ON p.player_id = ps.id
        LEFT JOIN rated_results rr ON rr.pickup_id = p.pickup_id
        WHERE p.pickup_id = ? AND p.is_captain = 1
        `, [pickupId]);

        if (!data[0].length) {
            return null;
        }

        const reports = [];

        data[0].forEach(row => {
            reports.push({
                captain: {
                    id: row.user_id,
                    nick: row.current_nick
                },
                reported: row.result
            });
        });

        return reports;
    }

    static async getLatestRatedPickup(guildId: bigint): Promise<RateablePickup | null> {
        const data: any = await db.execute(`
        SELECT pc.id AS pickupConfigId, pc.name, ps.id AS pickupId, ps.started_at, pp.team, t.name AS team_alias, p.user_id, pr.rating, p.current_nick, pp.is_captain, rr.result FROM pickup_configs pc
        JOIN pickups ps ON ps.pickup_config_id = pc.id
        JOIN pickup_players pp ON ps.id = pp.pickup_id
        LEFT JOIN rated_results rr ON rr.pickup_id = ps.id AND rr.team = pp.team
        LEFT JOIN teams t ON t.guild_id = pc.guild_id AND t.team_id = pp.team
        JOIN players p ON p.id = pp.player_id
        LEFT JOIN player_ratings pr ON pr.player_id = p.id AND pr.pickup_config_id = pc.id
        WHERE pc.guild_id = ? AND pc.is_rated = 1
        AND ps.id = (SELECT MAX(p.id) FROM pickups p
                    JOIN pickup_configs pc ON pc.id = p.pickup_config_id
                    LEFT JOIN rated_results rr ON p.id = rr.pickup_id
                    WHERE pc.guild_id = ? AND pc.is_rated = 1 AND rr.result IS NOT NULL);
        `, [guildId, guildId]);

        if (!data[0].length) {
            return null;
        }

        let pickupId: number;
        let pickupConfigId: number;
        let name: string;
        let startedAt: Date;
        let isRated: boolean;
        let captains = [];
        const teams = new Map();

        data[0].forEach((row, index) => {
            if (!index) {
                pickupId = row.pickupId;
                pickupConfigId = row.pickupConfigId;
                name = row.name;
                startedAt = row.started_at;
                isRated = row.result !== null ? true : false;
            }

            if (row.is_captain) {
                captains.push({ team: row.team, alias: row.team_alias, id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }

            const team = teams.get(row.team);

            if (!team) {
                teams.set(row.team, {
                    name: row.team,
                    alias: row.team_alias,
                    outcome: row.result,
                    players: [{ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick }]
                });
            } else {
                team.players.push({ id: row.user_id.toString(), rating: row.rating, nick: row.current_nick });
            }
        });

        return {
            pickupId,
            pickupConfigId,
            name,
            startedAt,
            isRated,
            captains,
            teams: Array.from(teams.values())
        } as unknown as RateablePickup;
    }
}