import Mysql2 from 'mysql2';
import db from '../core/db';

export default class PickupModel {
    private constructor() { }

    static async areValidPickups(guildId: bigint, ...pickups) {
        const results = await db.execute(`
        SELECT name FROM pickup_configs
        WHERE guild_id = ? AND name IN (${Array(pickups.length).fill('?').join(',')})
        `, [guildId, ...pickups])

        return results[0].map(result => result.name);
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
}