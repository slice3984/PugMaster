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

    static async setExpire(guildId: bigint, playerId: bigint, timeInMinutes: number) {
        const expireDate = new Date(new Date().getTime() + timeInMinutes * 60000);

        await db.execute(`
        INSERT INTO state_active_expires VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE expiration_date = ?
        `, [guildId, playerId, expireDate, expireDate]);
        return;
    }

    static async removeExpires(guildId: bigint, ...playerIds) {
        await db.query(`
        DELETE FROM state_active_expires
        WHERE guild_id = ${guildId} AND player_id IN (${playerIds.join(', ')})
        `)
    }

    static async getExpires(guildId: bigint, ...playerIds): Promise<Date> {
        const expiresIn = await db.query(`
        SELECT expiration_date FROM state_active_expires
        WHERE guild_id = ${guildId} AND player_id IN (${playerIds.join(', ')})
        `);

        if (!expiresIn[0][0]) {
            return null;
        }
        return expiresIn[0].map(row => row.expiration_date);
    }

    static async getAos(guildId: bigint, ...playerIds) {
        const aos = await db.query(`
        SELECT expiration_date, player_id FROM state_active_aos
        WHERE guild_id = ${guildId} AND player_id IN (${playerIds.join(', ')})
        `);

        if (!aos[0][0]) {
            return null;
        }

        return aos[0];
    }

    static async setAo(guildId: bigint, playerId: bigint, timeInMs: number) {
        const expireDate = new Date(new Date().getTime() + timeInMs);

        await db.execute(`
        INSERT INTO state_active_aos VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE expiration_date = ?
        `, [guildId, playerId, expireDate, expireDate]);

        return;
    }

    static async removeAos(guildId: bigint, ...playerIds) {
        await db.query(`
        DELETE FROM state_active_aos WHERE
        guild_id = ${guildId} AND player_id IN (${playerIds.join(', ')})
        `);
        return;
    }
}