import Mysql2 from 'mysql2';
import { PickupSettings } from '../core/types';
import db from '../core/db';

export default class PickupModel {
    private constructor() { }

    static async areValidPickups(guildId: bigint, ...pickups): Promise<{ name: string; id: number }[]> {
        const results = await db.execute(`
        SELECT name, id FROM pickup_configs
        WHERE guild_id = ? AND name IN (${Array(pickups.length).fill('?').join(',')})
        `, [guildId, ...pickups])

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

    static async getActivePickup(guildId: bigint, nameOrConfigId: number | string):
        Promise<{ name: string, players: { id: bigint | null, nick: string }[]; maxPlayers: number; configId: number }> {
        let result;

        if (typeof nameOrConfigId === 'number') {
            result = await db.execute(`
            SELECT c.id, c.name, s.player_id, c.player_count, p.current_nick FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id
            WHERE c.guild_id = ? AND c.id = ?;
            `, [guildId, nameOrConfigId]);
        } else {
            result = await db.execute(`
            SELECT c.id, c.name, s.player_id, c.player_count, p.current_nick FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id
            WHERE c.guild_id = ? AND c.name = ?;
            `, [guildId, nameOrConfigId]);
        }

        if (!result[0].length) {
            return;
        }

        const players = [];

        for (const row of result[0]) {
            players.push({
                id: BigInt(row.player_id),
                nick: row.current_nick
            });
        }

        return {
            name: result[0][0].name,
            players,
            maxPlayers: result[0][0].player_count,
            configId: result[0][0].id
        }
    }

    static async getActivePickups(guildId: bigint, includingDefaults = false): Promise<Map<string,
        { name: string, players: { id: bigint | null, nick: string | null }[]; maxPlayers: number; configId: number }>> {
        let result;

        if (!includingDefaults) {
            result = await db.execute(`
            SELECT c.id, c.name, player_id, c.player_count, p.current_nick FROM state_pickup_players
            JOIN pickup_configs c ON pickup_config_id = id 
            JOIN players p ON user_id = player_id
            WHERE c.guild_id = ?
            `, [guildId]);
        } else {
            result = await db.execute(`
            SELECT c.id, c.name, s.player_id, c.player_count, p.current_nick FROM pickup_configs c
            LEFT JOIN state_pickup_players s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id
            WHERE c.guild_id = ? AND (s.player_id IS NOT NULL OR c.is_default_pickup = true)
            `, [guildId]);
        }
        const pickups = new Map();

        for (const row of result[0]) {
            if (!pickups.has(row.name)) {
                pickups.set(row.name, { name: row.name, players: [{ id: row.player_id ? BigInt(row.player_id) : null, nick: row.current_nick }], maxPlayers: row.player_count, configId: row.id });
                continue;
            }
            pickups.get(row.name).players.push({ id: row.player_id ? BigInt(row.player_id) : null, nick: row.current_nick });
        }

        return pickups;
    }

    static async getAddedPlayers() {
        const players = await db.query(`
        SELECT player_id, guild_id FROM state_pickup_players
        `);

        return players[0];
    }

    static async getStoredPickupCount(guildId: bigint) {
        const count = await db.execute(`
        SELECT COUNT(*) AS cnt FROM pickup_configs
        WHERE guild_id = ?
        `, [guildId]);

        return count[0][0].cnt;
    }

    static async isPlayerAdded(guildId: bigint, playerId: bigint, ...pickupConfigIds): Promise<number[]> {
        if (pickupConfigIds.length === 0) {
            const result = await db.execute(`
            SELECT pickup_config_id FROM state_pickup_players
            WHERE guild_id = ? AND player_id = ?
            `, [guildId, playerId]);
            return result[0].map(row => row.pickup_config_id);
        }
        const result = await db.execute(`
        SELECT pickup_config_id FROM state_pickup_players
        WHERE guild_id = ? AND player_id = ?
        AND pickup_config_id IN (${Array(pickupConfigIds.length).fill('?').join(',')})
        `, [guildId, playerId, ...pickupConfigIds]);

        return result[0].map(row => row.pickup_config_id);
    }

    static async addPlayer(guildId: bigint, playerId: bigint, ...pickupConfigIds) {
        let valueStrings2 = [];
        let pickups = [];

        pickupConfigIds.forEach(id => {
            valueStrings2.push(`(${guildId}, ${playerId}, ${id})`)
            pickups.push(`(${guildId}, ${id})`);
        });

        // Update state pickup
        await db.query(`
        INSERT IGNORE INTO state_pickup (guild_id, pickup_config_id)
        VALUES ${pickups.join(', ')}
        `);

        // Insert pickup player
        await db.query(`
        INSERT state_pickup_players
        VALUES ${valueStrings2.join(', ')}
        `);
        return;
    }

    static async removePlayers(guildId: bigint, ...playerIds) {
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

        return;
    }

    static async removePlayer(guildId: bigint, playerId: bigint, ...pickupConfigIds) {
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
        return;
    }

    static async updatePlayerAddTime(guildId: bigint, playerId: bigint) {
        await db.execute(`
        INSERT INTO state_guild_player (guild_id, player_id, last_add)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON DUPLICATE KEY UPDATE last_add = CURRENT_TIMESTAMP
        `, [guildId, playerId]);
        return;
    }

    static async getPickupSettings(guildId: BigInt, pickup: number | string): Promise<PickupSettings> {
        let settings;

        if (typeof pickup === 'number') {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND id  = ?
            `, [guildId, pickup]);
        } else {
            settings = await db.execute(`
            SELECT * FROM pickup_configs
            WHERE guild_id = ? AND name = ?
            `, [guildId, pickup]);
        }

        settings = settings[0][0];

        return {
            id: settings.id,
            name: settings.name,
            playerCount: settings.player_count,
            teamCount: settings.team_count,
            isDefaultPickup: Boolean(settings.is_default_pickup),
            mapPoolId: settings.mappool_id ? settings.mappool_id : null,
            afkCheck: Boolean(settings.afk_check),
            pickMode: settings.pick_mode,
            whitelistRole: settings.whitelist_role ? BigInt(settings.whitelist_role) : null,
            blacklistRole: settings.blacklist_role ? BigInt(settings.blacklist_role) : null,
            promotionRole: settings.promotion_role ? BigInt(settings.promotion_role) : null,
            captainRole: settings.captain_role ? BigInt(settings.captain_role) : null,
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
            whitelistRole: settings.whitelist_role ? BigInt(settings.whitelist_role) : null,
            blacklistRole: settings.blacklist_role ? BigInt(settings.blacklist_role) : null,
            promotionRole: settings.promotion_role ? BigInt(settings.promotion_role) : null,
            captainRole: settings.captain_role ? BigInt(settings.captain_role) : null,
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

    static async setPending(guildId: bigint, pickupConfigId: number, stage: 'afk_check' | 'picking_manual' | 'fill') {
        await db.execute(`
        UPDATE state_pickup SET stage = ?, in_stage_since = CURRENT_TIMESTAMP, stage_iteration = 0
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [stage, guildId, pickupConfigId]);
    }

    static async setPendings(guildId: bigint, stage: 'afk_check' | 'picking_manual' | 'fill', ...pickupConfigIds) {
        await db.execute(`
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

    static async isInStage(guildId: bigint, pickupConfigId: number, stage: 'afk_check' | 'picking_manual' | 'fill') {
        const inStage = await db.execute(`
        SELECT COUNT(*) as pending FROM state_pickup
        WHERE guild_id = ? AND pickup_config_id = ? AND stage = ?
        `, [guildId, pickupConfigId, stage]);

        return inStage[0][0].pending;
    }
}