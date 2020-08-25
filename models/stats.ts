import db from '../core/db';
import { PickupInfo } from '../core/types';
import PickupModel from './pickup';
import PlayerModel from './player';

export default class StatsModel {
    private constructor() { }

    static async storePickup(guildId: bigint, pickupConfigId: number, teams: bigint[] | bigint[][], captains?: bigint[]) {
        captains = captains || [];

        const conn = await db.getConnection();
        try {
            let gotTeams = false;

            // Check if there are multiple teams
            if (Array.isArray(teams[0])) {
                gotTeams = true;
            }
            await conn.query('START TRANSACTION');

            // Insert pickup
            await conn.execute(`
            INSERT INTO pickups (guild_id, pickup_config_id, has_teams)
            VALUES (?, ?, ?)
            `, [guildId, pickupConfigId, gotTeams]);

            let idOfPickup = await (await conn.execute(`
            SELECT MAX(id) AS id FROM pickups
            WHERE guild_id = ?
            `, [guildId]))[0][0].id;

            const players = [];

            if (gotTeams) {
                for (const [index, team] of (teams as BigInt[][]).entries()) {
                    const teamName = String.fromCharCode(65 + index);

                    const playerIds = await conn.execute(`
                    SELECT id, user_id FROM players
                    WHERE guild_id = ?
                    AND user_id IN (${Array(team.length).fill('?').join(',')})
                    `, [guildId, ...team]);

                    playerIds[0].forEach(player => {
                        players.push(`(${idOfPickup}, ${player.id}, '${teamName}', ${captains.includes(BigInt(player.user_id))})`);
                    });
                }

                await conn.query(`
                INSERT INTO pickup_players VALUES ${players.join(', ')}
                `);
            } else {
                const playerIds = await conn.execute(`
                SELECT id, user_id FROM players
                WHERE guild_id = ?
                AND user_id IN (${Array(teams.length).fill('?').join(',')})
                `, [guildId, ...teams]);

                playerIds[0].forEach(player => {
                    players.push(`(${idOfPickup}, ${player.id})`);
                });

                await conn.query(`
                INSERT INTO pickup_players (pickup_id, player_id) VALUES ${players.join(', ')}
                `);
            }

            await conn.commit();
        } catch (_err) {
            console.log(_err);
            await conn.query('ROLLBACK');
        } finally {
            await conn.release();
        }
    }

    static async getLastGame(guildId: bigint, identifier?: { isPlayer: boolean; value: number | string }): Promise<PickupInfo | null> {
        let pickup;

        if (!identifier) {
            pickup = await db.execute(`
            SELECT p.current_nick, pc.name, ps.started_at, ps.id FROM players p
            JOIN pickup_players pp ON pp.player_id = p.id
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
            WHERE ps.id = (SELECT MAX(id) FROM pickups WHERE guild_id = ?)
            `, [guildId]);
        } else {
            if (!identifier.isPlayer) {
                // By pickup
                pickup = await db.execute(`
                SELECT p.current_nick, pc.name, ps.started_at, ps.id FROM players p
                JOIN pickup_players pp ON pp.player_id = p.id
                JOIN pickups ps ON pp.pickup_id = ps.id
                JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                WHERE ps.id = (
					SELECT MAX(ps.id) FROM pickups ps
                    JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                    WHERE pc.guild_id = ? AND pc.name = ?
				)           
            `, [guildId, identifier.value]);
            } else {
                // By player
                pickup = await db.execute(`
                SELECT p.current_nick, pc.name, ps.started_at, ps.id FROM players p
                JOIN pickup_players pp ON pp.player_id = p.id
                JOIN pickups ps ON pp.pickup_id = ps.id
                JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                WHERE ps.id = (SELECT MAX(pickup_id) FROM pickup_players WHERE player_id = ?)
                `, [identifier.value])
            }
        }

        if (pickup[0].length > 0) {
            pickup = pickup[0];

            const id = pickup[0].id;
            const name = pickup[0].name;
            const startedAt = pickup[0].started_at;
            const playerNicks = [];

            pickup.forEach(row => {
                playerNicks.push(row.current_nick);
            });

            return {
                id,
                name,
                startedAt,
                playerNicks
            }
        } else {
            return null;
        }
    }

    static async getTop(guildId: bigint, period: 'alltime' | 'day' | 'week' | 'month' | 'year', limit: number):
        Promise<{ nick: string, amount: number }[]> {
        let results;
        let intervalTime;

        switch (period) {
            case 'day':
                intervalTime = 'DAY';
                break;
            case 'week':
                intervalTime = 'WEEK';
                break;
            case 'month':
                intervalTime = 'MONTH';
                break;
            case 'year':
                intervalTime = 'YEAR';
        }

        if (period === 'alltime') {
            results = await db.execute(`
            SELECT p.current_nick, COUNT(pp.player_id) as amount FROM pickup_players pp
            JOIN players p ON pp.player_id = p.id
            WHERE p.guild_id = ?
            GROUP BY pp.player_id ORDER BY amount DESC
            LIMIT ?
            `, [guildId, limit]);
        } else {
            results = await db.execute(`
            SELECT p.current_nick, COUNT(pp.player_id) as amount FROM pickup_players pp
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN players p ON pp.player_id = p.id
            WHERE p.guild_id = ? AND ((NOW() - INTERVAL 1 ${intervalTime})  < ps.started_at)
            GROUP BY pp.player_id ORDER BY amount DESC
            LIMIT ?
            `, [guildId, limit]);
        }

        const top = [];

        results[0].forEach(row => {
            top.push({
                nick: row.current_nick,
                amount: row.amount
            });
        });

        return top;
    }

    static async getStats(guildId: bigint, identifier?: string | number) {
        let results;
        const stats = [];

        // All pickups
        if (!identifier) {
            results = await db.execute(`
            SELECT COUNT(p.id) as amount, pc.name FROM pickups p
            JOIN pickup_configs pc ON pc.id = p.pickup_config_id
            WHERE p.guild_id = ?
            GROUP BY p.pickup_config_id
            ORDER BY amount DESC;
            `, [guildId]);

            results[0].forEach(row => {
                stats.push({
                    name: row.name,
                    amount: row.amount
                });
            })
        }

        // Specific pickup
        if (identifier && typeof identifier === 'string') {
            results = await db.execute(`
            SELECT COUNT(p.id) as amount, pc.name FROM pickups p
            JOIN pickup_configs pc ON pc.id = p.pickup_config_id
            WHERE p.guild_id = ? AND pc.name = ?
            GROUP BY pc.name
            `, [guildId, identifier]);

            if (!results[0].length) {
                return stats;
            }

            stats.push({
                name: results[0][0].name,
                amount: results[0][0].amount
            });
        }

        // By player
        if (identifier && typeof identifier === 'number') {
            results = await db.execute(`
            SELECT COUNT(p.id) as amount, pc.name, ANY_VALUE(pl.current_nick) as current_nick FROM pickups p
            JOIN pickup_players pp ON pp.pickup_id = p.id
            JOIN pickup_configs pc ON p.pickup_config_id = pc.id
            JOIN players pl ON pp.player_id = pl.id
            WHERE p.guild_id = ? AND pl.id = ?
            GROUP BY p.pickup_config_id
            ORDER BY amount DESC
            `, [guildId, identifier]);

            results[0].forEach(row => {
                stats.push({
                    name: row.name,
                    amount: row.amount,
                    nick: row.current_nick
                });
            })
        }

        return stats;
    }

    static async getLastActive(guildId: bigint, limit: number, period: number, pickup?: string):
        Promise<{ id: bigint, amount: number }[]> {
        let results = [];
        let data;

        if (!pickup) {
            data = await db.execute(`
            SELECT count(ps.user_id) as amount, ps.user_id FROM pickups p
            JOIN pickup_players pp ON p.id = pp.pickup_id
            JOIN players ps ON pp.player_id = ps.id
            WHERE p.guild_id = ? AND ((NOW() - INTERVAL ? DAY) < p.started_at)
            GROUP BY pp.player_id
            ORDER BY amount DESC
            LIMIT ?
            `, [guildId, period, limit]);

        } else {
            data = await db.execute(`
            SELECT count(ps.user_id) as amount, ps.user_id FROM pickups p
            JOIN pickup_players pp ON p.id = pp.pickup_id
            JOIN players ps ON pp.player_id = ps.id
            JOIN pickup_configs pc ON p.pickup_config_id = pc.id
            WHERE p.guild_id = ? AND ((NOW() - INTERVAL ? DAY) < p.started_at) AND pc.name = ?
            GROUP BY pp.player_id
            ORDER BY amount DESC
            LIMIT ?
            `, [guildId, period, pickup, limit])
        }

        data[0].forEach(row => {
            results.push({
                id: BigInt(row.user_id),
                amount: row.amount
            });
        })

        return results;
    }
}