import db from '../core/db';
import { PickupInfo, PickupInfoAPI, PlayerSearchResult } from '../core/types';

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

                    const playerIds: any = await conn.execute(`
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
                const playerIds: any = await conn.execute(`
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
        Promise<{ id: string, amount: number }[]> {
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
                id: row.user_id.toString(),
                amount: row.amount
            });
        })

        return results;
    }

    static async getPlayerCount(guildId: bigint): Promise<number> {
        const data = await db.execute(`
        SELECT COUNT(DISTINCT(p.id)) AS players FROM players p
        JOIN pickup_players pp ON p.id = pp.player_id
        WHERE p.guild_id = ?;
        `, [guildId]);

        return data[0][0].players;
    }

    static async getLastPickupDates(guildId: bigint, daysLimit: number): Promise<Date[]> {
        const data: any = await db.execute(`
        SELECT p.started_at as date FROM pickups p
        WHERE p.guild_id = ? AND ((NOW() - INTERVAL ${daysLimit} DAY) < p.started_at)
        `, [guildId]);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => row.date);
    }

    static async getPickupCount(guildId: bigint): Promise<number> {
        const data = await db.execute(`
        SELECT COUNT(id) as pickups from pickups
        WHERE guild_id = ?
        `, [guildId]);

        return data[0][0].pickups;
    }

    static async getPickups(guildId: bigint, orderField: string, desc: boolean, start: number, limit: number): Promise<{
        id: number;
        name: string;
        players: number;
        date: Date;
    }[]> {
        let results = [];

        const data: any = await db.execute(`
        SELECT p.id, pc.name, pc.player_count, p.started_at as date FROM pickups p
        JOIN pickup_configs pc ON p.pickup_config_id = pc.id
        WHERE p.guild_id = ?
        ORDER BY ${orderField} ${desc ? 'DESC' : 'ASC'}, p.started_at DESC
        LIMIT ${start}, ${limit}
        `, [guildId]);

        data[0].forEach(row => {
            results.push({
                id: row.id,
                name: row.name,
                players: row.player_count,
                date: row.date
            });
        });

        return results;
    }

    static async getPickupInfo(guildId: bigint, pickupId: number): Promise<PickupInfoAPI | { foundPickup: boolean }> {
        const data: any = await db.execute(`
        SELECT p.id, p.is_rated, pp.team, ps.elo, ps.current_nick, ps.user_id, rr.winner_team FROM pickups p
        JOIN pickup_players pp ON p.id = pp.pickup_id
        JOIN players ps ON pp.player_id = ps.id
        LEFT JOIN rated_results rr ON rr.pickup_id = p.id
        WHERE p.guild_id = ? and p.id = ?
        `, [guildId, pickupId]);

        let puId: number;
        let isRated: boolean;
        let winnerTeam: string | null;

        const teams = new Map();

        if (!data[0].length) {
            return {
                foundPickup: false
            }
        }

        data[0].forEach((row, index) => {
            if (!index) {
                puId = row.id;
                isRated = Boolean(row.is_rated);
                winnerTeam = row.winner_team;
            }

            if (!row.team) {
                const team = teams.get('A');

                if (!team) {
                    teams.set('A', {
                        name: 'A',
                        players: [{ id: row.user_id.toString(), elo: row.elo, nick: row.current_nick }]
                    });
                } else {
                    team.players.push({
                        id: row.user_id.toString(),
                        elo: row.elo,
                        nick: row.current_nick
                    });
                }
            } else {
                const team = teams.get(row.team);

                if (!team) {
                    teams.set(row.team, {
                        name: row.team, players: [{ id: row.user_id.toString(), elo: row.elo, nick: row.current_nick }]
                    });
                } else {
                    team.players.push({
                        id: row.user_id.toString(),
                        elo: row.elo,
                        nick: row.current_nick
                    })
                }
            }
        });

        const pickupInfo = {
            foundPickup: true,
            id: puId,
            isRated,
            winnerTeam,
            teams: Array.from(teams.values())
        } as unknown as PickupInfoAPI;

        return pickupInfo;
    }

    static async getPickupRowNum(guildId: bigint, pickupId: number): Promise<Number> {
        const data: any = await db.execute(`
        SELECT * FROM (SELECT id, guild_id, ROW_NUMBER()
        OVER (ORDER BY started_at DESC) AS row_num FROM pickups) p
        WHERE p.guild_id = ? AND p.id = ?;
        `, [guildId, pickupId]);

        if (!data[0].length) {
            return null;
        }

        return data[0][0].row_num;
    }

    static async searchPlayer(guildId: bigint, searchStr: string, limit: number): Promise<PlayerSearchResult[]> {
        // Didn't find a better not overcomplicated query, returns 3x the same user in the worst case
        // always keep the first result of a user and discard the rest
        const data: any = await db.execute(`
        SELECT * FROM (SELECT p.guild_id, p.user_id, p.elo, p.id as id, p.current_nick as current, pn.nick as old, pn.updated_at FROM players p
            LEFT JOIN player_nicks pn ON p.id = pn.player_id WHERE p.guild_id = ?) as t
        WHERE t.user_id = ? 
        OR t.current LIKE ?
        OR t.old LIKE ?
        ORDER BY (
            IF ( t.user_id = ?, 3, 0 ) +
            IF ( t.current LIKE ?, 2, 0 ) +
            IF ( t.old LIKE ?, 1, 0 )
        ) DESC, (t.updated_at), (t.id)
        LIMIT ${3 * limit};
        `, [guildId, searchStr, `%${searchStr}%`, `%${searchStr}%`, searchStr, `%${searchStr}%`, `%${searchStr}%`]);

        if (!data[0].length) {
            return [];
        }

        const results = [];

        // Get rid of duplicates
        let currentId = '';
        data[0].forEach(row => {
            if (row.user_id == currentId) {
                return;
            }

            results.push({
                id: row.user_id,
                currentNick: row.current,
                knownAs: row.old,
                elo: row.elo
            });

            currentId = row.user_id;
        });

        const ret: PlayerSearchResult[] = data[0].filter((row, index) => index === data[0].findIndex(row2 => row2.user_id === row.user_id))
            .slice(0, limit)
            .map(row => {
                return {
                    id: row.user_id,
                    currentNick: row.current,
                    knownAs: row.old,
                    elo: row.elo
                }
            });

        return ret;
    }

    static async getLastPlayerPickups(guildId: bigint, playerId: bigint, limit: number): Promise<{ id: number; name: string; start: Date; isRated: boolean; players: number }[]> {
        const data: any = await db.execute(`
        SELECT p.id, p.started_at, p.is_rated, pc.name, pc.player_count FROM pickups p
        JOIN pickup_players pp ON pp.pickup_id = p.id
        JOIN pickup_configs pc ON p.pickup_config_id = pc.id
        JOIN players ps ON pp.player_id = ps.id
        WHERE p.guild_id = ? AND ps.user_id = ?
        ORDER BY p.started_at DESC
        LIMIT ${limit}
        `, [guildId, playerId]);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => {
            return {
                id: row.id,
                name: row.name,
                start: row.started_at,
                isRated: Boolean(row.is_rated),
                players: row.player_count
            };
        });
    }

    static async getPlayerNickHistory(guildId: bigint, playerId: bigint): Promise<string[]> {
        const data: any = await db.execute(`
        SELECT p.elo, p.current_nick, pn.nick, pn.updated_at FROM players p
        LEFT JOIN player_nicks pn ON pn.player_id = p.id
        WHERE p.guild_id = ? AND p.user_id = ?
        ORDER BY pn.updated_at;
        `, [guildId, playerId]);

        if (!data[0].length) {
            return [];
        }

        return Array.from(new Set(data[0].map(row => row.nick || row.current_nick)));
    }

    static async getPlayedPickupsForPlayer(guildId: bigint, playerId: bigint): Promise<{ name: string; amount: number; lastgame: Date }[]> {
        const data: any = await db.execute(`
        SELECT COUNT(ps.pickup_config_id) as amount, MAX(pc.name) as name, MAX(ps.started_at) as date FROM players p
        JOIN pickup_players pp ON pp.player_id = p.id
        JOIN pickups ps ON ps.id = pp.pickup_id
        JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
        WHERE p.guild_id = ? AND p.user_id = ?
        GROUP BY ps.pickup_config_id
        `, [guildId, playerId]);

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => {
            return {
                name: row.name,
                amount: row.amount,
                lastgame: row.date
            };
        });
    }

    static async getPlayerInfo(guildId: bigint, playerId: bigint): Promise<{ id: string; name: string; elo: number | null } | null> {
        const data: any = await db.execute(`
        SELECT user_id, current_nick, elo FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        if (!data[0].length) {
            return;
        }

        return {
            id: data[0][0].user_id.toString(),
            name: data[0][0].current_nick,
            elo: data[0][0].elo
        };
    }
}