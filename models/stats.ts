import { Rating } from 'ts-trueskill';
import db, { transaction } from '../core/db';
import { PickupInfo, PickupInfoAPI, PickupStartConfiguration, PlayerSearchResult } from '../core/types';
import PickupModel from './pickup';

export default class StatsModel {
    private constructor() { }

    static async storePickup(config: PickupStartConfiguration) {
        let captains = config.captains || [];
        let gotTeams = false;

        const guildId = BigInt(config.guild.id);
        const pickupConfigId = config.pickupConfigId;

        // Check if there are multiple teams
        if (Array.isArray(config.teams[0])) {
            gotTeams = true;
        } else {
            const pickupSettings = await PickupModel.getPickupSettings(guildId, pickupConfigId);
            // if the team amount is equal the player count we can assign each player to a team
            if (config.teams.length === pickupSettings.teamCount) {
                gotTeams = true;
                captains = (config.teams as bigint[]).map(p => BigInt(p));  // Every player is also a captain
                config.teams = (config.teams as bigint[]).map(p => [p]);
            }
        }

        await transaction(db, async (db) => {
            // Insert pickup
            if (!config.map) {
                await db.execute(`
                INSERT INTO pickups (guild_id, pickup_config_id, has_teams)
                VALUES (?, ?, ?)
                `, [guildId, pickupConfigId, gotTeams]);
            } else {
                await db.execute(`
                INSERT INTO pickups (guild_id, pickup_config_id, map, has_teams)
                VALUES (?, ?, ?, ?)
                `, [guildId, pickupConfigId, config.map, gotTeams]);
            }

            let idOfPickup = await (await db.execute(`
            SELECT MAX(id) AS id FROM pickups
            WHERE guild_id = ?
            `, [guildId]))[0][0].id;

            const players = [];

            if (gotTeams) {
                for (const [index, team] of (config.teams as BigInt[][]).entries()) {
                    const teamName = String.fromCharCode(65 + index);

                    const playerIds: any = await db.execute(`
                    SELECT id, user_id FROM players
                    WHERE guild_id = ?
                    AND user_id IN (${Array(team.length).fill('?').join(',')})
                    `, [guildId, ...team]);

                    playerIds[0].forEach(player => {
                        players.push(`(${idOfPickup}, ${player.id}, '${teamName}', ${captains.includes(BigInt(player.user_id))})`);
                    });
                }

                await db.query(`
                INSERT INTO pickup_players (pickup_id, player_id, team, is_captain) VALUES ${players.join(', ')}
                `);
            } else {
                const playerIds: any = await db.execute(`
                SELECT id, user_id FROM players
                WHERE guild_id = ?
                AND user_id IN (${Array(config.teams.length).fill('?').join(',')})
                `, [guildId, ...config.teams]);

                playerIds[0].forEach(player => {
                    players.push(`(${idOfPickup}, ${player.id})`);
                });

                await db.query(`
                INSERT INTO pickup_players (pickup_id, player_id) VALUES ${players.join(', ')}
                `);
            }
        });
    }

    static async getLastGame(guildId: bigint, identifier?: { isPlayer: boolean; value: number | string }): Promise<PickupInfo | null> {
        let pickup;

        if (!identifier) {
            pickup = await db.execute(`
            SELECT p.current_nick,
            p.user_id,
            pc.name,
            pp.is_captain,
            pc.is_rated,
            pr.rating,
            pr.variance,
            IFNULL(t.name, pp.team) as team,
            rr.result,
            ps.started_at,
            ps.id FROM players p
            JOIN pickup_players pp ON pp.player_id = p.id
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
            LEFT JOIN player_ratings pr ON pr.pickup_config_id = ps.pickup_config_id AND p.id = pr.player_id
            LEFT JOIN rated_results rr ON pp.pickup_id = rr.pickup_id AND pp.team = rr.team
            LEFT JOIN teams t ON t.team_id = pp.team AND t.guild_id = pc.guild_id
            WHERE ps.id = (SELECT MAX(p.id) FROM pickups p
                JOIN pickup_configs pc ON pc.id = p.pickup_config_id
                WHERE p.guild_id = ? AND pc.is_enabled = 1)
            `, [guildId]);
        } else {
            if (!identifier.isPlayer) {
                // By pickup
                pickup = await db.execute(`
                SELECT p.current_nick,
                p.user_id,
                pc.name,
                pp.is_captain,
                pc.is_rated,
                pr.rating,
				pr.variance,
                IFNULL(t.name, pp.team) as team,
                rr.result,
                ps.started_at,
                ps.id FROM players p
                    JOIN pickup_players pp ON pp.player_id = p.id
                    JOIN pickups ps ON pp.pickup_id = ps.id
                    JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                    LEFT JOIN player_ratings pr ON pr.pickup_config_id = ps.pickup_config_id AND p.id = pr.player_id
                    LEFT JOIN rated_results rr ON pp.pickup_id = rr.pickup_id AND pp.team = rr.team
                    LEFT JOIN teams t ON t.team_id = pp.team AND t.guild_id = pc.guild_id
                    WHERE ps.id = (
                        SELECT MAX(ps.id) FROM pickups ps
                        JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                        WHERE pc.guild_id = ? AND pc.name = ? AND pc.is_enabled = 1
                    )
            `, [guildId, identifier.value]);
            } else {
                // By player
                pickup = await db.execute(`
                SELECT p.current_nick,
                p.user_id,
                pc.name,
                pp.is_captain,
                pc.is_rated,
                pr.rating,
				pr.variance,
                IFNULL(t.name, pp.team) as team,
                rr.result,
                ps.started_at,
                ps.id FROM players p
                    JOIN pickup_players pp ON pp.player_id = p.id
                    JOIN pickups ps ON pp.pickup_id = ps.id
                    JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
                    LEFT JOIN player_ratings pr ON pr.pickup_config_id = ps.pickup_config_id AND p.id = pr.player_id
                    LEFT JOIN rated_results rr ON pp.pickup_id = rr.pickup_id AND pp.team = rr.team
                    LEFT JOIN teams t ON t.team_id = pp.team AND t.guild_id = pc.guild_id
                    WHERE ps.id = (SELECT MAX(pp.pickup_id) FROM pickup_players pp
                        JOIN pickups p ON p.id = pp.pickup_id
                        JOIN pickup_configs pc ON pc.id = p.pickup_config_id 
                        WHERE player_id = ? AND pc.is_enabled = 1)
                `, [identifier.value])
            }
        }

        if (pickup[0].length > 0) {
            let id, name, startedAt, isRated;
            const teams = new Map();

            pickup[0].forEach((row, index) => {
                if (!index) {
                    id = row.id,
                        name = row.name,
                        startedAt = row.started_at,
                        isRated = Boolean(row.is_rated)
                }

                const playerObj = {
                    nick: row.current_nick,
                    id: row.user_id.toString(),
                    rating: row.rating ? new Rating(row.rating, row.variance) : new Rating(),
                    isCaptain: Boolean(row.is_captain)
                }

                // No team pickups - Default to team A
                if (!row.team) {
                    if (!teams.get('A')) {
                        teams.set('A', {
                            name: 'A',
                            outcome: null,
                            players: [playerObj]
                        });
                    } else {
                        teams.get('A').players.push(playerObj);
                    }
                } else {
                    // Teams
                    const team = teams.get(row.team);

                    if (!team) {
                        teams.set(row.team, {
                            name: row.team,
                            outcome: row.result,
                            players: [playerObj]
                        })
                    } else {
                        team.players.push(playerObj);
                    }
                }
            });

            return {
                id,
                name,
                startedAt,
                isRated,
                teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name)) // sort in case of wrong order 
            }
        } else {
            return null;
        }
    }

    static async getPickup(guildId: bigint, pickupId?: number): Promise<PickupInfo | null> {
        let pickup;

        if (!pickupId) {
            pickup = await db.execute(`
            SELECT p.current_nick,
            p.user_id,
			pr.rating,
			pr.variance,
            pc.name,
            pp.is_captain,
            pc.is_rated,
            pp.team,
            rr.result,
            ps.started_at,
            ps.id FROM players p
            JOIN pickup_players pp ON pp.player_id = p.id
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
            LEFT JOIN player_ratings pr ON pr.pickup_config_id = ps.pickup_config_id AND p.id = pr.player_id
            LEFT JOIN rated_results rr ON pp.pickup_id = rr.pickup_id AND pp.team = rr.team
            WHERE ps.id = (SELECT MAX(id) FROM pickups WHERE guild_id = ?)
            `, [guildId]);
        } else {
            pickup = await db.execute(`
            SELECT p.current_nick,
            p.user_id,
			pr.rating,
			pr.variance,
            pc.name,
            pp.is_captain,
            pc.is_rated,
            pp.team,
            rr.result,
            ps.started_at,
            ps.id FROM players p
            JOIN pickup_players pp ON pp.player_id = p.id
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN pickup_configs pc ON ps.pickup_config_id = pc.id
            LEFT JOIN player_ratings pr ON pr.pickup_config_id = ps.pickup_config_id AND p.id = pr.player_id
            LEFT JOIN rated_results rr ON pp.pickup_id = rr.pickup_id AND pp.team = rr.team
            WHERE ps.id = ? AND ps.guild_id = ?
            `, [pickupId, guildId]);
        }

        if (pickup[0].length > 0) {
            let id, name, startedAt, isRated;
            const teams = new Map();

            pickup[0].forEach((row, index) => {
                if (!index) {
                    id = row.id,
                        name = row.name,
                        startedAt = row.started_at,
                        isRated = Boolean(row.is_rated)
                }

                const playerObj = {
                    nick: row.current_nick,
                    id: row.user_id.toString(),
                    rating: row.rating ? new Rating(row.rating, row.variance) : new Rating(),
                    isCaptain: Boolean(row.is_captain)
                }

                // No team pickups - Default to team A
                if (!row.team) {
                    if (!teams.get('A')) {
                        teams.set('A', {
                            name: 'A',
                            outcome: null,
                            players: [playerObj]
                        });
                    } else {
                        teams.get('A').players.push(playerObj);
                    }
                } else {
                    // Teams
                    const team = teams.get(row.team);

                    if (!team) {
                        teams.set(row.team, {
                            name: row.team,
                            outcome: row.result,
                            players: [playerObj]
                        })
                    } else {
                        team.players.push(playerObj);
                    }
                }
            });

            return {
                id,
                name,
                startedAt,
                isRated,
                teams: Array.from(teams.values()).sort((a, b) => a.name.localeCompare(b.name)) // sort in case of wrong order 
            }
        } else {
            return null;
        }
    }

    static async getTopPickupAmount(guildId: bigint, period: 'alltime' | 'day' | 'week' | 'month' | 'year', limit: number):
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
            JOIN pickups ps ON ps.id = pp.pickup_id
            JOIN pickup_configs pc ON pc.id = ps.pickup_config_id
            WHERE p.guild_id = ? AND pc.is_enabled = 1
            GROUP BY pp.player_id ORDER BY amount DESC
            LIMIT ?
            `, [guildId, limit]);
        } else {
            results = await db.execute(`
            SELECT p.current_nick, COUNT(pp.player_id) as amount FROM pickup_players pp
            JOIN pickups ps ON pp.pickup_id = ps.id
            JOIN pickup_configs pc ON pc.id = ps.pickup_config_id
            JOIN players p ON pp.player_id = p.id
            WHERE p.guild_id = ? AND ((NOW() - INTERVAL 1 ${intervalTime})  < ps.started_at) AND pc.is_enabled = 1
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

    static async getLeaderboardRatings(pickupConfigId: number, page: number):
        Promise<{
            pickupConfigId: number;
            pickup: string;
            rankRatingCap: number;
            ratings: { rank: number, nick: string; rating: number, variance: number, wins: number, losses: number, draws: number }[]
        }> {
        page = page - 1;
        const results: any = await db.execute(`
            SELECT
                ROW_NUMBER() OVER (PARTITION BY pc.id ORDER BY pr.rating - pr.variance * 3 DESC) AS global_rank,
                pc.id,
                pc.name,
                rc.lastgame,
                pc.max_rank_rating_cap,
                p.current_nick,
                pr.rating,
                pr.variance,
                rc.win,
                rc.loss,
                rc.draw 
            FROM
                player_ratings pr 
                JOIN
                pickup_configs pc 
                ON pc.id = pr.pickup_config_id 
                JOIN
                players p 
                ON p.id = pr.player_id 
                JOIN
                (
                    SELECT
                        res.player_id,
                        sum(res.win) AS win,
                        sum(res.loss) AS loss,
                        sum(res.draw) AS draw,
                        MAX(res.started_at) as lastgame
                    FROM
                        (
                            SELECT
                            pp.player_id,
                            p.started_at,
                            CASE
                                rr.result 
                                WHEN
                                    'win' 
                                THEN
                                    1 
                                ELSE
                                    0 
                            END
                            AS win, 
                            CASE
                                rr.result 
                                WHEN
                                    'loss' 
                                THEN
                                    1 
                                ELSE
                                    0 
                            END
                            AS loss, 
                            CASE
                                rr.result 
                                WHEN
                                    'draw' 
                                THEN
                                    1 
                                ELSE
                                    0 
                            END
                            AS draw 
                            FROM
                            pickups p 
                            JOIN
                                pickup_players pp 
                                ON p.id = pp.pickup_id 
                            JOIN
                                rated_results rr 
                                ON rr.team = pp.team 
                                AND rr.pickup_id = pp.pickup_id 
                            WHERE
                            p.pickup_config_id = ?
                            AND pp.rating IS NOT NULL 
                        )
                        res 
                    GROUP BY
                        res.player_id 
                )
                rc 
                ON p.id = rc.player_id 
            WHERE
                pc.id = ?
                AND ((NOW() - INTERVAL 14 DAY) < rc.lastgame)
            ORDER BY
                global_rank ASC
                LIMIT 10 OFFSET ${page * 10}
            `, [pickupConfigId, pickupConfigId]);

        const ratings = {
            pickupConfigId: null,
            pickup: null,
            rankRatingCap: null,
            ratings: []
        };

        if (!results[0].length) {
            return null;
        }

        results[0].forEach((row, idx) => {
            if (!idx) {
                ratings.pickupConfigId = row.id;
                ratings.pickup = row.name;
                ratings.rankRatingCap = row.max_rank_rating_cap;
            }

            ratings.ratings.push({
                rank: row.global_rank,
                nick: row.current_nick,
                rating: row.rating,
                variance: row.variance,
                wins: row.win,
                losses: row.loss,
                draws: row.draw
            })
        });

        return ratings;
    }

    static async getPlayerRatings(guildId: bigint, playerId: bigint):
        Promise<{
            pickupCount: number;
            nick: string;
            ratings: {
                pickup: string;
                rankRatingCap: number;
                rating: number;
                variance: number,
                wins: number,
                losses: number,
                draws: number,
                globalRank: number | null
            }[]
        }> {
        const results: any = await db.execute(`
        SELECT
        p.pickup_config_id,
        pp.player_id,
        SUM(
        CASE
           rr.result 
           WHEN
              'win' 
           THEN
              1 
           ELSE
              0 
        END
     ) as win, SUM(
        CASE
           rr.result 
           WHEN
              'loss' 
           THEN
              1 
           ELSE
              0 
        END
     ) as loss, SUM(
        CASE
           rr.result 
           WHEN
              'draw' 
           THEN
              1 
           ELSE
              0 
        END
     ) as draw, COUNT(*) AS pickups, ps.current_nick, pc.name, pc.max_rank_rating_cap, pr.rating, pr.variance, rankings.global_rank 
     FROM
        pickups p 
        JOIN
           pickup_players pp 
           ON pp.pickup_id = p.id 
        JOIN
           rated_results rr 
           ON rr.team = pp.team 
           AND rr.pickup_id = pp.pickup_id 
        JOIN
           players ps 
           ON ps.id = pp.player_id 
        JOIN
           pickup_configs pc 
           ON pc.id = p.pickup_config_id 
        JOIN
           player_ratings pr 
           ON pr.player_id = pp.player_id 
           AND pr.pickup_config_id = p.pickup_config_id 
        LEFT JOIN
           (
              SELECT
                 p.pickup_config_id,
                 pp.player_id,
                 ROW_NUMBER() OVER (PARTITION BY p.pickup_config_id 
              ORDER BY
                 pr.rating - pr.variance * 3 DESC) AS global_rank 
              FROM
                 pickups p 
                 JOIN
                    pickup_players pp 
                    ON p.id = pp.pickup_id 
                 JOIN
                    player_ratings pr 
                    ON pr.player_id = pp.player_id 
                    AND pr.pickup_config_id = p.pickup_config_id 
              WHERE
                 p.is_rated = 1 
                 AND 
                 (
     (NOW() - INTERVAL 14 DAY) < p.started_at
                 )
                 AND p.guild_id = ? 
              GROUP BY
                 p.pickup_config_id,
                 pp.player_id 
           )
           rankings 
           ON p.pickup_config_id = rankings.pickup_config_id 
           AND pp.player_id = rankings.player_id 
     WHERE
        p.guild_id = ? 
        AND p.is_rated = 1 
        AND ps.user_id = ?
        AND pc.is_enabled = 1
     GROUP BY
        p.pickup_config_id,
        pp.player_id 
     ORDER BY
        pickups DESC;
        `, [guildId, guildId, playerId]);

        const ratings = {
            pickupCount: 0,
            nick: null,
            ratings: []
        };

        if (!results[0].length) {
            return null;
        }

        results[0].forEach((row, idx) => {
            if (!idx) {
                ratings.nick = row.current_nick;
            }

            ratings.pickupCount += row.pickups;

            ratings.ratings.push({
                pickup: row.name,
                rankRatingCap: row.max_rank_rating_cap,
                rating: row.rating,
                variance: row.variance,
                wins: row.win,
                losses: row.loss,
                draws: row.draw,
                globalRank: row.global_rank
            });
        });

        return ratings;
    }

    static async getTopRatings(guildId: bigint):
        Promise<{ pickup: string; players: { nick: string; rating: number; variance: number }[] }[]> {
        const results: any = await db.execute(`
        SELECT
            * 
        FROM
            (
            SELECT
                pc.id,
                pc.guild_id,
                pc.name,
                pr.rating,
                pr.variance,
                p.current_nick,
                amounts.count_pickups,
                lg.lastgame,
                ROW_NUMBER() OVER (PARTITION BY pr.pickup_config_id 
            ORDER BY
                pr.rating - pr.variance * 3 DESC) AS pickup_row 
            FROM
                pickup_configs pc 
                JOIN
                    player_ratings pr 
                    ON pr.pickup_config_id = pc.id 
                JOIN
                    players p 
                    ON p.id = pr.player_id 
                LEFT JOIN
                    (
                        SELECT
                        ROUND((COUNT(*) / pc.team_count)) AS count_pickups,
                        pc.name,
                        pc.id 
                        FROM
                        rated_results rr 
                        JOIN
                            pickups p 
                            ON p.id = rr.pickup_id 
                        JOIN
                            pickup_configs pc 
                            ON pc.id = p.pickup_config_id 
                        WHERE
                        pc.guild_id = ? 
                        GROUP BY
                        pc.id 
                    )
                    amounts 
                    ON amounts.id = pc.id 
                JOIN
                    (
                        SELECT
                        MAX(ps.started_at) as lastgame,
                        pp.player_id,
                        ps.pickup_config_id 
                        FROM
                        pickups ps 
                        JOIN
                            pickup_players pp 
                            ON ps.id = pp.pickup_id 
                        WHERE
                        ps.guild_id = ? 
                        GROUP BY
                        pp.player_id,
                        ps.pickup_config_id 
                    )
                    lg 
                    ON lg.player_id = p.id 
                    AND lg.pickup_config_id = pc.id 
            WHERE ((NOW() - INTERVAL 14 DAY) < lg.lastgame) AND pc.is_enabled = 1
            )
            res 
        WHERE
            res.guild_id = ? 
            AND res.pickup_row < 11 
        ORDER BY
            res.count_pickups DESC,
            res.rating DESC;
        `, [guildId, guildId, guildId]);

        const ratings = [];

        results[0].forEach(row => {
            let pickup = ratings.find(p => p.pickup === row.name);

            if (!pickup) {
                ratings.push({
                    pickup: row.name,
                    players: []
                })

                pickup = ratings.find(p => p.pickup === row.name);
            }

            pickup.players.push({
                nick: row.current_nick,
                rating: row.rating,
                variance: row.variance
            });
        });
        return ratings;
    }

    static async getStats(guildId: bigint, identifier?: string | number) {
        let results;
        const stats = [];

        // All pickups
        if (!identifier) {
            results = await db.execute(`
            SELECT COUNT(p.id) as amount, pc.name FROM pickups p
            JOIN pickup_configs pc ON pc.id = p.pickup_config_id
            WHERE p.guild_id = ? AND pc.is_enabled = 1
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
            WHERE p.guild_id = ? AND pc.name = ? AND pc.is_enabled = 1
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
            WHERE p.guild_id = ? AND pl.id = ? AND pc.is_enabled = 1
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
        SELECT p.id, p.is_rated, IFNULL(t.name, pp.team) as team, p.map, ps.current_nick, ps.user_id, rr.result FROM pickups p
        JOIN pickup_players pp ON p.id = pp.pickup_id
        JOIN players ps ON pp.player_id = ps.id
        LEFT JOIN rated_results rr ON rr.pickup_id = p.id AND rr.team = pp.team
        LEFT JOIN teams t ON t.team_id = pp.team AND t.guild_id = p.guild_id
        WHERE p.guild_id = ? and p.id = ?
        `, [guildId, pickupId]);

        let puId: number;
        let isRated: boolean;
        let map: String;

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
                map = row.map;
            }

            if (!row.team) {
                const team = teams.get('A');

                if (!team) {
                    teams.set('A', {
                        name: 'A',
                        outcome: null,
                        players: [{ id: row.user_id.toString(), nick: row.current_nick }]
                    });
                } else {
                    team.players.push({
                        id: row.user_id.toString(),
                        nick: row.current_nick
                    });
                }
            } else {
                const team = teams.get(row.team);

                if (!team) {
                    teams.set(row.team, {
                        name: row.team,
                        outcome: row.result,
                        players: [
                            {
                                id: row.user_id.toString(),
                                nick: row.current_nick
                            }
                        ]
                    });
                } else {
                    team.players.push({
                        id: row.user_id.toString(),
                        nick: row.current_nick
                    })
                }
            }
        });

        const pickupInfo = {
            foundPickup: true,
            id: puId,
            isRated,
            map,
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
        SELECT * FROM (SELECT p.guild_id, p.user_id, p.id as id, p.current_nick as current, pn.nick as old, pn.updated_at FROM players p
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
        SELECT p.current_nick, pn.nick, pn.updated_at FROM players p
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

    static async getPlayerInfo(guildId: bigint, playerId: bigint): Promise<{ id: string; name: string; ratings: { name: string; rating: number; variance: number }[] } | null> {
        const data: any = await db.execute(`
		SELECT p.user_id, p.current_nick, pr.rating, pr.variance, pc.name  FROM players p
        LEFT JOIN player_ratings pr ON p.id = pr.player_id
		LEFT JOIN pickup_configs pc ON pc.id = pr.pickup_config_id AND pc.is_rated = 1
        WHERE p.guild_id = ? AND p.user_id = ?
        `, [guildId, playerId]);

        if (!data[0].length) {
            return;
        }

        let id;
        let name;
        let ratings = [];

        data[0].forEach(row => {
            if (!id) {
                id = row.user_id.toString();
                name = row.current_nick
            }

            // There can be ratings for afterwards disabled rated pickups, exclude them
            if (row.name) {
                ratings.push({
                    name: row.name,
                    rating: row.rating,
                    variance: row.variance
                });
            }
        });

        return {
            id,
            name,
            ratings
        };
    }

    static async getPickupCountPlayers(guildId: bigint, pickupConfigId: number, ...playerIds):
        Promise<{ amount: number; id: string; nick: string }[]> {
        const data: any = await db.execute(`
        SELECT COUNT(*) as amount, ps.user_id, ps.current_nick FROM pickups p
        JOIN pickup_players pp ON p.id = pp.pickup_id
        JOIN players ps ON ps.id = pp.player_id
        WHERE p.guild_id = ? AND p.pickup_config_id = ?
        AND ps.user_id IN (${Array(playerIds.length).fill('?').join(',')})
        GROUP BY pp.player_id
        ORDER BY amount DESC
        `, [guildId, pickupConfigId, ...playerIds]);

        if (!data[0].length) {
            return [];
        }
        return data[0].map(row => {
            return {
                amount: row.amount,
                id: row.user_id.toString(),
                nick: row.current_nick
            }
        })
    }

    static async replacePlayer(guildId: bigint, pickupId: number, playerToReplace: bigint, replacementPlayer: bigint) {
        const playerToReplaceId: any = await db.execute(`
        SELECT id FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerToReplace]);

        const replacementPlayerId: any = await db.execute(`
        SELECT id FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, replacementPlayer]);

        if (!playerToReplaceId[0].length || !replacementPlayerId[0].length) {
            return null;
        }

        await db.execute(`
        UPDATE pickup_players SET player_id = ?
        WHERE pickup_id = ? AND player_id = ?
        `, [replacementPlayerId[0][0].id, pickupId, playerToReplaceId[0][0].id]);
    }

    // Pass ids as strings because bigints can't be serialized
    static async swapPlayers(guildId: bigint, pickupId: number, firstPlayer: { team: string, id: string }, secondPlayer: { team: string, id: string }) {
        const playerOne: any = await db.execute(`
        SELECT id FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, BigInt(firstPlayer.id)]);

        const playerTwo: any = await db.execute(`
        SELECT id FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, BigInt(secondPlayer.id)]);

        if (!playerOne[0].length || !playerTwo[0].length) {
            return null;
        }

        await transaction(db, async (db) => {
            // First
            await db.execute(`
            UPDATE pickup_players SET player_id = ?
            WHERE pickup_id = ? AND player_id = ? AND team = ?
            `, [playerTwo[0][0].id, pickupId, playerOne[0][0].id, firstPlayer.team]);

            // Second
            await db.execute(`
            UPDATE pickup_players SET player_id = ?
            WHERE pickup_id = ? AND player_id = ? AND team = ?
            `, [playerOne[0][0].id, pickupId, playerTwo[0][0].id, secondPlayer.team]);
        });
    }

    static async getLastPlayedMaps(pickupConfigId: number, limit: number): Promise<string[]> {
        const data: any = await db.execute(`
        SELECT map FROM pickups
        WHERE pickup_config_id = ? AND map IS NOT NULL
        ORDER BY id DESC
        LIMIT ${limit};
        `, [pickupConfigId])

        if (!data[0].length) {
            return [];
        }

        return data[0].map(row => row.map);
    }

    static async getTotalPickupsCount(): Promise<number> {
        const data: any = await db.query(`
        SELECT COUNT(*) AS amount FROM pickups;
        `,)

        return data[0][0].amount;
    }

    static async getTotalKnownPlayers(): Promise<number> {
        const data: any = await db.query(`
        SELECT COUNT(DISTINCT user_id) AS amount from players;
        `);

        return data[0][0].amount;
    }
}