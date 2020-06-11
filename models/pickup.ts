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

    static async getActivePickups(guildId: bigint): Promise<Map<string,
        { players: bigint[]; maxPlayers: number; configId: number }>> {
        const result = await db.query(`
        SELECT id, c.name, player_id, c.player_count FROM state_active_pickups
        JOIN pickup_configs c ON pickup_config_id = id WHERE c.guild_id = ${guildId}
        `);

        const pickups = new Map();

        for (const row of result[0]) {
            if (!pickups.has(row.name)) {
                pickups.set(row.name, { players: [BigInt(row.player_id)], maxPlayers: row.player_count, configId: row.id });
                continue;
            }
            pickups.get(row.name).players.push(BigInt(row.player_id));
        }

        return pickups;
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

    static async updatePlayerAddTime(guildId: bigint, playerId: bigint) {
        await db.execute(`
            INSERT INTO state_add_times VALUES (${guildId}, ${playerId}, CURRENT_TIMESTAMP)
            ON DUPLICATE KEY UPDATE added_at = CURRENT_TIMESTAMP
        `);
        return;
    }

}