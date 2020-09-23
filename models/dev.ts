import db from '../core/db';
import PlayerModel from './player';

// Utility model for development
export default class DevModel {
    private constructor() { }

    static async getFakeUsers(guildId: BigInt): Promise<{ id: string; name: string }[]> {
        // Fake users got a id < 100000000000001000
        const results = await db.execute(`
        SELECT p.user_id, p.current_nick FROM players p
        WHERE p.user_id < 100000000000001000 AND p.guild_id = ?
        `, [guildId]);

        const users = [];

        results[0].forEach(row => {
            users.push({
                id: row.user_id,
                name: row.current_nick
            });
        });

        return users;
    }

    static async generateFakeUser(guildId: bigint): Promise<{ id: string; name: string }> {
        // Get available id
        const maxFakePlayerId = await db.execute(`
        SELECT CASE WHEN MAX(p.user_id) IS NULL THEN 100000000000000001 ELSE MAX(p.user_id) + 1 END AS id FROM players p
        WHERE p.guild_id = ? AND p.user_id < 100000000000001000
        `, [guildId]);

        const id = maxFakePlayerId[0][0].id;
        const displayId = id.replace('100000000000000', '');

        const fakeNick = `Fake ${displayId}`;

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
        WHERE p.guild_id = ? AND p.user_id < 100000000000001000;
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
}