import db, { transaction } from '../core/db';
import PlayerModel from './player';

interface FakeUser {
    id: string;
    name: string;
}

// Utility model for development
export default class DevModel {
    private constructor() { }

    static async getFakeUsers(guildId: BigInt): Promise<FakeUser[]> {
        // Fake users got a id < 100000000000001000
        const results: any = await db.execute(`
        SELECT p.user_id, p.current_nick FROM players p
        WHERE p.user_id < 1000 AND p.guild_id = ?
        `, [guildId]);

        const users: FakeUser[] = [];

        results[0].forEach(row => {
            users.push({
                id: row.user_id.toString(),
                name: row.current_nick
            });
        });

        return users;
    }

    static async generateFakeUser(guildId: bigint): Promise<{ id: string; name: string }> {
        // Get available id
        const maxFakePlayerId = await db.execute(`
        SELECT CASE WHEN MAX(p.user_id) IS NULL THEN 1 ELSE MAX(p.user_id) + 1 END AS id FROM players p
        WHERE p.guild_id = ? AND p.user_id < 1000
        `, [guildId]);

        const id = maxFakePlayerId[0][0].id.toString();
        const fakeNick = `Fake ${id}`;

        // Insert fake player
        await PlayerModel.storeOrUpdatePlayer(guildId, BigInt(id), fakeNick);

        return {
            id,
            name: fakeNick
        }
    }

    static async removeFakeUser(guildId: bigint) {
        const idData = await db.execute(`
        SELECT MAX(p.user_id) as id FROM players p
        WHERE p.guild_id = ? AND p.user_id < 1000;
        `, [guildId]);

        await db.execute(`
        DELETE FROM players
        WHERE guild_id = ? AND user_id = ? 
        `, [guildId, idData[0][0].id]);
    }

    static async clearPickup(guildId: bigint, pickupConfigId: number) {
        await db.execute(`
        DELETE FROM state_pickup
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [guildId, pickupConfigId]);

        await db.execute(`
        DELETE FROM state_pickup_players
        WHERE guild_id = ? AND pickup_config_id = ?
        `, [guildId, pickupConfigId]);
    }

    static async unrateAllPickups(guildId: bigint) {
        await transaction(db, async db => {
            // Rated results
            await db.execute(`
            DELETE rr.* FROM rated_results rr
            JOIN pickups p ON rr.pickup_id = p.id
			WHERE p.is_rated = 1 and p.guild_id = ?
            `, [guildId]);

            // Pickups
            await db.execute(`
            UPDATE pickups SET is_rated = 0
            WHERE guild_id = ?
            `, [guildId]);

            // Players
            await db.execute(`
            UPDATE pickup_players pp
            JOIN pickups ps ON ps.id = pp.pickup_id
            SET pp.rating = null, pp.variance = null
            WHERE ps.guild_id =  ?
            `, [guildId]);

            // Ratings
            await db.execute(`
            UPDATE players SET rating = null, variance = null
            WHERE guild_id = ?
            `, [guildId]);
        });
    }

    static async clearAllStoredPickups(guildId: bigint) {
        await db.execute(`
        DELETE FROM pickups
        WHERE guild_id = ?
        `, [guildId]);
    }
}