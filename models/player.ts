import db from '../core/db';

export default class PlayerModel {
    private constructor() { }

    static async isPlayerStored(guildId: bigint, playerId: bigint) {
        const result = await db.query(`
        SELECT COUNT(*) as cnt FROM players
        wHERE guild_id = ${guildId} AND user_id = ${playerId}
        `);

        return result[0][0].cnt;
    }

    static async storeOrUpdatePlayer(guildId: bigint, playerId: bigint, nick: string) {
        // Get the current nick, no results => create user
        const nickAndId = await db.query(`
        SELECT current_nick, id FROM players WHERE user_id = ${playerId}
        `);

        // Player not stored
        if (nickAndId[0].length === 0) {
            await db.execute(`
            INSERT INTO players (guild_id, user_id, current_nick) VALUES (?, ?, ?)
            `, [guildId, playerId, nick]);
        } else {
            // Update the nick if required and store the old one in player_nicks
            if (nickAndId[0][0].current_nick !== nick) {
                // Update nick
                await db.execute(`
                UPDATE players SET current_nick = ? WHERE user_id = ?
                `, [nick, playerId]);

                // Insert old nick
                await db.execute(`
                INSERT INTO player_nicks (player_id, nick)
                VALUES (?, ?)
                `, [nickAndId[0][0].id, nickAndId[0][0].current_nick]);

                // Get the amount of already stored old nicks
                const amountStored = await db.query(`
                SELECT COUNT(*) as cnt FROM player_nicks
                WHERE player_id = ${nickAndId[0][0].id}
                `);

                if (amountStored[0][0].cnt > 2) {
                    // Delete the oldest nick
                    const oldestNickId = await db.query(`
                    SELECT id FROM player_nicks 
                    WHERE player_id = ${nickAndId[0][0].id}
                    ORDER BY updated_at LIMIT 1
                    `);

                    await db.query(`
                    DELETE FROM player_nicks WHERE id = ${oldestNickId[0][0].id}
                    `);
                }
            }
        }
    }

    static async arePlayersTrusted(guildId: bigint, ...playersIds): Promise<number[]> {
        const trustedPlayers = await db.query(`
        SELECT user_id FROM players
        WHERE guild_id = ${guildId} AND trusted = 1 AND user_id IN (${playersIds.join(', ')})
        `);

        return trustedPlayers[0].map(row => row.user_id);
    }

    static async trustPlayers(guildId: bigint, ...playersIds) {
        await db.query(`
        UPDATE players SET trusted = 1
        WHERE guild_id = ${guildId} AND user_id IN (${playersIds.join(', ')})
        `);
        return;
    }
}