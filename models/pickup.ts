import Mysql2 from 'mysql2';
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

    static async getActivePickups(guildId: bigint, includingDefaults = false): Promise<Map<string,
        { name: string, players: { id: bigint | null, nick: string | null }[]; maxPlayers: number; configId: number }>> {
        let result;

        if (!includingDefaults) {
            result = await db.query(`
            SELECT c.id, c.name, player_id, c.player_count, p.current_nick FROM state_active_pickups
            JOIN pickup_configs c ON pickup_config_id = id 
            JOIN players p ON user_id = player_id
            WHERE c.guild_id = ${guildId}
            `);
        } else {
            result = await db.query(`
            SELECT c.id, c.name, s.player_id, c.player_count, p.current_nick FROM pickup_configs c
            LEFT JOIN state_active_pickups s ON s.pickup_config_id = c.id
            LEFT JOIN players p on p.user_id = s.player_id
            WHERE c.guild_id = ${guildId} AND (s.player_id IS NOT NULL OR c.is_default_pickup = true)
            `);
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
        SELECT player_id, guild_id FROM state_active_pickups
        `);

        return players[0];
    }

    static async getStoredPickupCount(guildId: bigint) {
        const count = await db.query(`
        SELECT COUNT(*) AS cnt FROM pickup_configs
        WHERE guild_id = ${guildId}
        `);

        return count[0][0].cnt;
    }

    static async isPlayerAdded(guildId: bigint, playerId: bigint, ...pickupConfigIds): Promise<number[]> {
        if (pickupConfigIds.length === 0) {
            const result = await db.query(`
            SELECT pickup_config_id FROM state_active_pickups
            WHERE guild_id = ${guildId} AND player_id = ${playerId}
            `);
            return result[0].map(row => row.pickup_config_id);
        }

        const result = await db.query(`
        SELECT pickup_config_id FROM state_active_pickups
        WHERE guild_id = ${guildId} AND player_id = ${playerId}
        AND pickup_config_id IN (${pickupConfigIds.join(', ')})
        `);

        return result[0].map(row => row.pickup_config_id);
    }

    static async addPlayer(guildId: bigint, playerId: bigint, ...pickupConfigIds) {
        let valueStrings = [];

        pickupConfigIds.forEach(id => {
            valueStrings.push(`(${guildId}, ${playerId}, ${id})`)
        });

        await db.query(`
        INSERT INTO state_active_pickups
        VALUES ${valueStrings.join(', ')}
        `);
        return;
    }

    static async removePlayers(guildId: bigint, ...playerIds) {
        await db.query(`
        DELETE FROM state_active_pickups
        WHERE guild_id = ${guildId} AND player_id IN (${playerIds.join(', ')})
        `);
        return;
    }

    static async removePlayer(guildId: bigint, playerId: bigint, ...pickupConfigIds) {
        if (pickupConfigIds.length === 0) {
            await db.query(`
            DELETE FROM state_active_pickups
            WHERE guild_id = ${guildId} AND player_id = ${playerId}
            `);
            return;
        }

        await db.query(`
        DELETE FROM state_active_pickups
        WHERE guild_id = ${guildId} AND player_id = ${playerId}
        AND pickup_config_id IN (${pickupConfigIds.join(', ')})
        `);
        return;
    }

    static async updatePlayerAddTime(guildId: bigint, playerId: bigint) {
        await db.execute(`
            INSERT INTO state_add_times VALUES (${guildId}, ${playerId}, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        `);
        return;
    }
}