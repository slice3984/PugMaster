import db from '../core/db';
import { transaction } from '../core/db';

export default class EloModel {
    private constructor() { }

    static async getEloRatings(guildId: bigint, getPrevRatings: boolean, ...playerIds: bigint[]):
        Promise<{ playerId: string, mu: number; sigma: number }[]> {
        const retrievedRatings: { playerId: string; mu: number; sigma: number }[] = [];

        let ratings: any;

        if (getPrevRatings) {
            ratings = await db.execute(`
            SELECT user_id, prev_elo, prev_variance FROM players
            WHERE guild_id = ? AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
            `, [guildId, ...playerIds]);
        } else {
            ratings = await db.execute(`
            SELECT user_id, elo, variance FROM players
            WHERE guild_id = ? AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
            `, [guildId, ...playerIds]);
        }

        ratings[0].forEach(rating => {
            if (!rating.elo) {
                return;
            }

            retrievedRatings.push({
                playerId: rating.user_id,
                mu: rating.elo,
                sigma: rating.variance
            });
        });

        return retrievedRatings;
    }

    static async ratePickup(guildId: bigint, pickupId: number, rerate: boolean, outcomes: { team: string; result: 'win' | 'draw' | 'loss' }[],
        ...ratingUpdates: { id: bigint, mu: number, sigma: number }[]) {
        const playerIds = ratingUpdates.map(r => r.id);
        const values = [];

        outcomes.forEach(outcome => {
            values.push(pickupId, outcome.team, outcome.result);
        });

        await transaction(db, async (db) => {
            // In case of a rerate remove the old ratings
            if (rerate) {
                await db.execute(`
                DELETE FROM rated_results WHERE pickup_id = ?
                `, [pickupId]);
            }

            // Set match result first
            await db.execute(`
        INSERT INTO rated_results VALUES ${Array(outcomes.length).fill('(?, ?, ?)').join(',')}
        `, values);

            await db.execute(`
        UPDATE pickups SET is_rated = 1 WHERE id = ?
        `, [pickupId]);

            // Store old ratings
            await db.execute(`
        UPDATE players SET prev_elo = elo, prev_variance = variance
        WHERE guild_id = ? AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);

            // Set new trueskill values
            let multiQueryString = '';

            ratingUpdates.forEach(rating => multiQueryString +=
                `UPDATE players SET elo = ${rating.mu}, variance = ${rating.sigma} WHERE guild_id = ${guildId} AND user_id = ${rating.id};\n`);

            await db.query(multiQueryString);
        });
    }

    static async unratePickup(guildId: bigint, pickupId: number, ...playerIds: bigint[]) {
        await transaction(db, async (db) => {
            // Remove results
            await db.execute(`
            DELETE FROM rated_results WHERE pickup_id = ?
            `, [pickupId]);
        });

        // Unrate
        await db.execute(`
        UPDATE pickups SET is_rated = 0 WHERE id = ?
        `, [pickupId])

        // Restore old ratings, remove current ratings
        await db.execute(`
        UPDATE players SET elo = prev_elo, variance = prev_variance
        WHERE guild_id = ? AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }
}