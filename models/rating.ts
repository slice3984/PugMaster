import { Rating } from 'ts-trueskill';
import db from '../core/db';
import { transaction } from '../core/db';
import { RatingPickup } from '../core/types';

export default class RatingModel {
    private constructor() { }

    static async rate(guildId: bigint, pickupId: number, outcomes: { team: string; result: 'win' | 'draw' | 'loss' }[],
        pickupRatings: { pickupId: number, players: { id: bigint, mu: number, sigma: number }[] }[]) {
        const outcomesToInsert = [];
        outcomes.forEach(outcome => outcomesToInsert.push(pickupId, outcome.team, outcome.result));

        // Generate pickup players update queries
        let pickupPlayerQueries = '';

        pickupRatings.forEach(pickup => {
            const pickupId = pickup.pickupId;

            pickup.players.forEach(p => {
                pickupPlayerQueries +=
                    `UPDATE pickup_players pp
                     JOIN players p ON pp.player_id = p.id
                     SET pp.rating = ${p.mu}, pp.variance = ${p.sigma} ` +
                    `WHERE p.guild_id = ${guildId} AND pp.pickup_id = ${pickupId} AND p.user_id = ${p.id};`;
            });
        });

        // Generate players update queries
        const ratingsMap: Map<bigint, { mu: number; sigma: number }> = new Map();
        let playersQueries = '';

        // Sort from oldest to newest to always store the newest skill ratings
        pickupRatings.sort((p1, p2) => p1.pickupId - p2.pickupId)
            .flatMap(pickup => pickup.players.flat())
            .forEach(player => ratingsMap.set(player.id, { mu: player.mu, sigma: player.sigma }));

        // Generate qeueries
        for (const [playerId, playerRating] of ratingsMap) {
            playersQueries +=
                `UPDATE players SET rating = ${playerRating.mu}, variance = ${playerRating.sigma}` +
                `WHERE guild_id = ${guildId} AND user_id = ${playerId};`;
        }


        await transaction(db, async (db) => {
            // Delete possible existing ratings just in case
            await db.execute(`
            DELETE FROM rated_results WHERE pickup_id = ?
            `, [pickupId]);

            // Set pickup to rated
            await db.execute(`
            UPDATE pickups SET is_rated = 1 WHERE id = ?
            `, [pickupId]);

            // Outcome ratings
            await db.execute(`
            INSERT INTO rated_results VALUES ${Array(outcomes.length).fill('(?, ?, ?)').join(',')}
            `, outcomesToInsert);

            // Remove possible left rating reports
            await db.execute(`
            DELETE FROM state_rating_reports
            WHERE pickup_id = ?
            `, [pickupId]);

            // Update pickup_players & player ratings
            await db.query(pickupPlayerQueries + playersQueries);
        });
    }

    static async unrate(guildId: BigInt, pickupId: number,
        pickupRatings: { pickupId: number, players: { id: bigint, mu: number, sigma: number }[] }[],
        playerRatings?: { id: bigint, mu: number | null, sigma: number | null }[]) {
        // Generate pickup players update queries
        let pickupPlayerQueries = '';

        if (!playerRatings) {
            pickupRatings.forEach(pickup => {
                const pickupId = pickup.pickupId;

                pickup.players.forEach(p => {
                    pickupPlayerQueries +=
                        `UPDATE pickup_players pp
                     JOIN players p ON pp.player_id = p.id
                     SET pp.rating = ${p.mu}, pp.variance = ${p.sigma} ` +
                        `WHERE p.guild_id = ${guildId} AND pp.pickup_id = ${pickupId} AND p.user_id = ${p.id};`;
                });
            });
        }
        // Generate players update queries
        const ratingsMap: Map<bigint, { mu: number; sigma: number }> = new Map();
        let playersQueries = '';

        if (!playerRatings) {
            // Sort from oldest to newest to always store the newest skill ratings
            pickupRatings.sort((p1, p2) => p1.pickupId - p2.pickupId)
                .flatMap(pickup => pickup.players.flat())
                .forEach(player => ratingsMap.set(player.id, { mu: player.mu, sigma: player.sigma }));

            // Generate qeueries
            for (const [playerId, playerRating] of ratingsMap) {
                playersQueries +=
                    `UPDATE players SET rating = ${playerRating.mu}, variance = ${playerRating.sigma}` +
                    `WHERE guild_id = ${guildId} AND user_id = ${playerId};`;
            }
        } else {
            // Latest pickup is being unrated, get previous rating values
            playerRatings.forEach(playerRating => {
                if (!playerRating.mu) {
                    playersQueries +=
                        `UPDATE players SET rating = null, variance = null` +
                        `WHERE guild_id = ${guildId} AND user_id = ${playerRating.id};`;
                } else {
                    playersQueries +=
                        `UPDATE players SET rating = ${playerRating.mu}, variance = ${playerRating.sigma}` +
                        `WHERE guild_id = ${guildId} AND user_id = ${playerRating.id};`;
                }
            });
        }

        await transaction(db, async (db) => {
            // Delete ratings
            await db.execute(`
            DELETE FROM rated_results WHERE pickup_id = ?
            `, [pickupId]);

            // Delete pickup player ratings
            await db.execute(`
            UPDATE pickup_players
            SET rating = null, variance = null
            WHERE pickup_id = ?
            `, [pickupId]);

            // Pickup
            await db.execute(`
            UPDATE pickups SET is_rated = 0
            WHERE id = ? 
            `, [pickupId]);

            // Update pickup_players & player ratings
            await db.query((playerRatings ? '' : pickupPlayerQueries) + playersQueries);
        });
    }

    static async getAmountOfFollowingPickups(guildId: bigint, from: number): Promise<number> {
        const data: any = await db.execute(`
        SELECT COUNT(DISTINCT p.id) as cnt FROM pickups p
        JOIN rated_results rr ON p.id = rr.pickup_id
        WHERE p.guild_id = ? AND p.id > ?
        `, [guildId, from])

        if (!data[0].length) {
            return null;
        }

        return data[0][0].cnt;
    }

    static async getLatestRatedPickups(guildId: bigint, max: number): Promise<RatingPickup[]> {
        const data: any = await db.execute(`
        SELECT * FROM (SELECT 
			pp.pickup_id,
            pp.team,
            rr.result,
            p.user_id,
            pp.rating,
            pp.variance,
            DENSE_RANK() OVER (ORDER BY ps.id DESC) as num_pickup FROM pickup_players pp
        JOIN pickups ps ON pp.pickup_id = ps.id AND ps.guild_id = ?
        JOIN players p ON pp.player_id = p.id AND p.guild_id = ?
        JOIN rated_results rr ON rr.pickup_id = pp.pickup_id AND rr.team = pp.team) res
        WHERE res.num_pickup <= ${max}
        `, [guildId, guildId]);

        if (!data[0].length) {
            return null;
        }

        let currentId;

        const pickupsMap: Map<number, RatingPickup> = new Map();

        data[0].forEach((row, index) => {
            if (currentId !== row.pickup_id) {
                if (!pickupsMap.get(row.pickup_id)) {
                    pickupsMap.set(row.pickup_id, { pickupId: row.pickup_id, teams: [] });
                }

                currentId = row.pickup_id;
            }

            const pickup = pickupsMap.get(row.pickup_id);
            const team = pickup.teams.find(team => team.team === row.team);

            // Add a new team
            if (!team) {
                pickup.teams.push({
                    team: row.team,
                    outcome: row.result,
                    players: [{ id: row.user_id.toString(), rating: row.rating ? new Rating(row.rating, row.variance) : new Rating() }]
                })
            } else {
                team.players.push({ id: row.user_id.toString(), rating: row.rating ? new Rating(row.rating, row.variance) : new Rating() });
            }
        });

        return Array.from(pickupsMap.values());
    }

    static async getPreviousNewestRatings(guildId: bigint, fromPickupId: number, ...playerIds: bigint[]): Promise<{ id: string, mu: number, sigma: number }[]> {
        const data: any = await db.execute(`
        SELECT * FROM (SELECT
            p.user_id,
            pp.rating,
            pp.variance,
            ROW_NUMBER() OVER (
                PARTITION BY p.user_id ORDER BY pp.pickup_id DESC) AS partitionRow FROM pickup_players pp
        JOIN players p ON p.id = pp.player_id AND p.guild_id = ?
        JOIN pickups ps ON ps.id = pp.pickup_id AND ps.guild_id = ?
        WHERE pp.pickup_id < ? AND p.user_id IN (${Array(playerIds.length).fill('?').join(',')}) AND pp.rating IS NOT NULL) res
        WHERE res.partitionRow = 1
        `, [guildId, guildId, fromPickupId, ...playerIds]);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => {
            return {
                id: row.user_id.toString(),
                mu: row.rating,
                sigma: row.variance
            }
        });
    }
}