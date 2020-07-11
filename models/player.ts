import db from '../core/db';
import Bot from '../core/bot';
import { PlayerNicks } from '../core/types';

export default class PlayerModel {
    private constructor() { }

    static async isPlayerStored(guildId: bigint, playerId: bigint) {
        const result = await db.execute(`
        SELECT COUNT(*) as cnt FROM players
        wHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        return result[0][0].cnt;
    }

    static async storeOrUpdatePlayer(guildId: bigint, playerId: bigint, nick: string) {
        // Get the current nick, no results => create user
        const nickAndId = await db.execute(`
        SELECT current_nick, id FROM players WHERE user_id = ? AND guild_id = ?
        `, [playerId, guildId]);

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
                UPDATE players SET current_nick = ? WHERE user_id = ? AND guild_id = ?
                `, [nick, playerId, guildId]);

                // Insert old nick
                await db.execute(`
                INSERT INTO player_nicks (player_id, nick)
                VALUES (?, ?)
                `, [nickAndId[0][0].id, nickAndId[0][0].current_nick]);

                // Get the amount of already stored old nicks
                const amountStored = await db.execute(`
                SELECT COUNT(*) as cnt FROM player_nicks
                WHERE player_id = ?
                `, [nickAndId[0][0].id]);

                if (amountStored[0][0].cnt > 2) {
                    // Delete the oldest nick
                    const oldestNickId = await db.execute(`
                    SELECT id FROM player_nicks 
                    WHERE player_id = ?
                    ORDER BY updated_at LIMIT 1
                    `, [nickAndId[0][0].id]);

                    await db.execute(`
                    DELETE FROM player_nicks WHERE id = ?
                    `, [oldestNickId[0][0].id]);
                }
            }
        }
    }

    static async arePlayersTrusted(guildId: bigint, ...playersIds): Promise<number[]> {
        const trustedPlayers = await db.execute(`
        SELECT user_id FROM players
        WHERE guild_id = ? AND trusted = 1 
        AND user_id IN (${Array(playersIds.length).fill('?').join(',')})
        `, [guildId, ...playersIds]);

        return trustedPlayers[0].map(row => row.user_id);
    }

    static async trustPlayers(guildId: bigint, ...playersIds) {
        await db.execute(`
        UPDATE players SET trusted = 1
        WHERE guild_id = ?
        AND user_id IN (${Array(playersIds.length).fill('?').join(',')})
        `, [guildId, ...playersIds]);
        return;
    }

    static async setExpire(guildId: bigint, playerId: bigint, timeInMs: number) {
        const expireDate = new Date(new Date().getTime() + timeInMs);

        await db.execute(`
        INSERT INTO state_guild_player (guild_id, player_id, pickup_expire)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE pickup_expire = ?
        `, [guildId, playerId, expireDate, expireDate]);
        return;
    }

    static async removeExpires(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET pickup_expire = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async getExpires(guildId: bigint, ...playerIds): Promise<Date> {
        const expiresIn = await db.execute(`
        SELECT pickup_expire FROM state_guild_player
        WHERE guild_id = ? AND pickup_expire IS NOT NULL
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);

        if (!expiresIn[0][0]) {
            return null;
        }
        return expiresIn[0].map(row => row.pickup_expire);
    }

    static async getAos(guildId: bigint, ...playerIds) {
        const aos = await db.execute(`
        SELECT ao_expire, player_id FROM state_guild_player
        WHERE guild_id = ?
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        AND ao_expire IS NOT NULL
        `, [guildId, ...playerIds]);

        if (!aos[0][0]) {
            return null;
        }

        return aos[0];
    }

    static async setAo(guildId: bigint, playerId: bigint, timeInMs: number) {
        const expireDate = new Date(new Date().getTime() + timeInMs);

        await db.execute(`
        INSERT INTO state_guild_player (guild_id, player_id, ao_expire)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE ao_expire = ?
        `, [guildId, playerId, expireDate, expireDate]);

        return;
    }

    static async removeAos(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET ao_expire = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
        return;
    }

    static async unbanPlayer(guildId: bigint, playerId: bigint | number) {
        if (typeof playerId === 'number') {
            await db.execute(`
            UPDATE bans SET is_active = false
            WHERE guild_id = ? AND player_id = ?
            `, [guildId, playerId]);
        } else {
            const id = await db.execute(`
            SELECT id FROM players WHERE guild_id = ? AND user_id = ?
            `, [guildId, playerId]);

            await db.execute(`
            UPDATE bans SET is_active = false
            WHERE guild_id = ? AND player_id = ?
            `, [guildId, id[0][0].id]);
        }
    }

    // 0ms bantime => perm
    static async banPlayer(guildId: bigint, issuerId: bigint, playerId: bigint, banTimeInMs: number, isWarnBan: boolean, reason?: string) {
        const endsAt = new Date(new Date().getTime() + banTimeInMs);

        const bannedPlayerId = await db.execute(`
        SELECT id FROM players WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        const issuerPlayerId = await db.execute(`
        SELECT id FROM players WHERE guild_id = ? AND user_id = ?
        `, [guildId, issuerId]);

        if (!banTimeInMs) {
            if (reason) {
                await db.execute(`
                INSERT INTO bans (guild_id, player_id, issuer_player_id, reason, permanent)
                VALUES (?, ?, ?, ?, ?)
                `, [guildId, bannedPlayerId[0][0].id, issuerPlayerId[0][0].id, reason, true]);
            } else {
                await db.execute(`
                INSERT INTO bans (guild_id, player_id, issuer_player_id, permanent)
                VALUES (?, ?, ?, ?)
                `, [guildId, bannedPlayerId[0][0].id, issuerPlayerId[0][0].id, true]);
            }

        } else {
            if (reason) {
                await db.execute(`
                INSERT INTO bans (guild_id, player_id, issuer_player_id, reason, ends_at, is_warn_ban)
                VALUES (?, ?, ?, ?, ?, ?)
                `, [guildId, bannedPlayerId[0][0].id, issuerPlayerId[0][0].id, reason || '-', endsAt, isWarnBan]);
            } else {
                await db.execute(`
                INSERT INTO bans (guild_id, player_id, issuer_player_id, ends_at, is_warn_ban)
                VALUES (?, ?, ?, ?, ?)
                `, [guildId, bannedPlayerId[0][0].id, issuerPlayerId[0][0].id, endsAt, isWarnBan]);

            }
        }

    }

    static async isPlayerBanned(guildId: bigint, playerId: bigint | number): Promise<{ player: string; issuer: string; ends_at: Date, reason: string, id: string, banid: string } | null> {
        let banInfo;

        if (typeof playerId === 'bigint') {
            banInfo = await db.execute(`
            SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.reason, p.id, b.id AS banid FROM bans b
            JOIN players p ON b.player_id = p.id
            JOIN players p2 ON b.issuer_player_id = p2.id
            WHERE (b.ends_at > current_date() OR b.permanent = true) AND b.is_active = true 
            AND p.user_id = ? AND b.guild_id = ? ORDER BY b.ends_at IS NULL DESC, b.ends_at DESC LIMIT 1
            `, [playerId, guildId]);
        } else {
            banInfo = await db.execute(`
            SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.reason, p.id, b.id AS banid FROM bans b
            JOIN players p ON b.player_id = p.id
            JOIN players p2 ON b.issuer_player_id = p2.id
            WHERE (b.ends_at > current_date() OR b.permanent = true) AND b.is_active = true 
            AND b.id = ? AND b.guild_id = ? ORDER BY b.ends_at IS NULL DESC, b.ends_at DESC LIMIT 1
            `, [playerId, guildId]);
        }


        return banInfo[0][0];
    }

    static async isPlayerWarned(guildId: bigint, playerId: bigint | number) {
        const guildSettings = Bot.getInstance().getGuild(guildId);
        let isWarned;

        if (typeof playerId === 'bigint') {
            isWarned = await db.execute(`
            SELECT current_nick FROM warns w
            JOIN players p ON p.id = w.player_id
            WHERE p.user_id = ?
            AND w.is_active = true
            AND DATE_ADD(warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
            AND w.guild_id = ?
            LIMIT 1
            `, [playerId, guildSettings.warnExpiration, guildId]);
        } else {
            isWarned = await db.execute(`
            SELECT current_nick FROM warns w
            JOIN players p ON p.id = w.player_id
            WHERE w.id = ? AND w.guild_id = ? AND w.is_active = true
            AND DATE_ADD(warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
            LIMIT 1
            `, [playerId, guildId, guildSettings.warnExpiration]);
        }

        if (isWarned[0][0]) {
            return isWarned[0][0].current_nick;
        }
    }

    static async getActiveWarns(guildId: bigint, playerId: bigint): Promise<{ current_nick: string, reason: string }[]> {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        const activeWarns = await db.execute(`
        SELECT p.current_nick, w.reason FROM warns w
        JOIN players p ON w.player_id = p.id
        WHERE w.guild_id = ? AND p.user_id = ?
        AND DATE_ADD(w.warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
        AND w.is_active = true
        `, [guildId, playerId, guildSettings.warnExpiration]);

        return activeWarns[0];
    }

    static async setActiveWarnsToFalse(guildId: bigint, playerId: bigint) {
        const dbPlayerId = await db.execute(`
        SELECT id FROM players WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        await db.execute(`
        UPDATE warns SET is_active = false WHERE guild_id = ?
        AND player_id = ?
        `, [guildId, dbPlayerId[0][0].id]);
    }

    static async getWarnsInStreak(guildId: bigint, playerId: bigint) {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        const warnsInStreak = await db.execute(`
        SELECT COUNT(w.id) as warnCount FROM warns w
        JOIN players p ON w.player_id = p.id
        WHERE w.guild_id = ? AND p.user_id = ?
        AND DATE_ADD(w.warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
        `, [guildId, playerId, guildSettings.warnStreakExpiration]);

        return warnsInStreak[0][0].warnCount;
    }

    static async warnPlayer(guildId: bigint, issuerId: bigint, playerId: bigint, reason?: string) {
        const dbPlayerId = await db.execute(`
        SELECT id FROM players WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        const dbIssuerPlayerId = await db.execute(`
        SELECT id FROM players WHERE guild_id = ? AND user_id = ?
        `, [guildId, issuerId]);

        if (reason) {
            await db.execute(`
            INSERT INTO warns (guild_id, player_id, issuer_player_id, reason)
            VALUES (?, ?, ?, ?)
            `, [guildId, dbPlayerId[0][0].id, dbIssuerPlayerId[0][0].id, reason]);
        } else {
            await db.execute(`
            INSERT INTO warns (guild_id, player_id, issuer_player_id)
            VALUES (?, ?, ?)
            `, [guildId, dbPlayerId[0][0].id, dbIssuerPlayerId[0][0].id]);
        }
    }

    static async unwarnPlayer(guildId: bigint, playerId: bigint | number, all: boolean) {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        if (all) {
            if (typeof playerId === 'bigint') {
                await db.execute(`
                UPDATE warns SET is_active = false
                WHERE player_id = (SELECT id FROM players WHERE user_id = ?)
                AND DATE_ADD(warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
                AND is_active = true
                AND guild_id = ?
                `, [playerId, guildSettings.warnExpiration, guildId]);
            } else {
                await db.execute(`
				UPDATE warns SET is_active = false
                WHERE player_id = (SELECT player_id FROM (SELECT * FROM warns) w WHERE w.id = ? AND w.guild_id = ?) 
                AND guild_id = ?
                AND is_active = true
                AND DATE_ADD(warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
                `, [playerId, guildId, guildId, guildSettings.warnExpiration]);
            }
        } else {
            if (typeof playerId === 'bigint') {
                await db.execute(`
                UPDATE warns SET is_active = false
                WHERE id = (
                  SELECT id FROM (
                    SELECT MAX(id) AS id FROM warns w
                    WHERE player_id = (
                      SELECT id FROM players WHERE user_id = ?
                      AND guild_id = ?
                    )
                    AND is_active = true
                    AND guild_id = ?
                    AND DATE_ADD(warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_DATE()
                  ) AS id
                )
                `, [playerId, guildId, guildId, guildSettings.warnExpiration]);
            } else {
                await db.execute(`
                UPDATE warns SET is_active = false
                WHERE guild_id = ? AND id = ?
                `, [guildId, playerId]);
            }
        }
    }

    static async isNotifyEnabled(guildId: bigint, playerId: bigint) {
        const enabled = await db.execute(`
        SELECT notifications FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);

        return enabled[0][0].notifications;
    }

    static async toggleNotify(guildId: bigint, playerId: bigint) {
        await db.execute(`
        UPDATE players SET notifications = !notifications
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, playerId]);
    }

    static async getPlayer(guildId: bigint, identifier: string): Promise<PlayerNicks | null> {
        let oldNick = false;
        let players = [];
        let testWithUserId = false;

        if (identifier.length < 20 && /^\d+$/.test(identifier)) {
            testWithUserId = true;
        }

        let gotPlayersWithCurrentNick;

        if (testWithUserId) {
            gotPlayersWithCurrentNick = await db.execute(`
            SELECT current_nick, id, user_id FROM players
            WHERE guild_id = ? AND (current_nick = ? OR user_id = ?)
            `, [guildId, identifier, BigInt(identifier)]);
        } else {
            gotPlayersWithCurrentNick = await db.execute(`
            SELECT current_nick, id, user_id FROM players
            WHERE guild_id = ? AND current_nick = ?
            `, [guildId, identifier]);
        }


        if (gotPlayersWithCurrentNick[0].length) {
            gotPlayersWithCurrentNick[0].forEach(player => {
                players.push({
                    currentNick: player.current_nick,
                    id: player.id,
                    userId: BigInt(player.user_id)
                });
            });
        } else {
            const playersWithOldNick = await db.execute(`
            SELECT pn.nick, p.current_nick, p.id, p.user_id FROM player_nicks pn
            JOIN players p ON pn.player_id = p.id
            WHERE p.guild_id = ? AND pn.nick = ?
            LIMIT 5
            `, [guildId, identifier]);

            if (playersWithOldNick[0].length) {
                oldNick = true;

                playersWithOldNick[0].forEach(player => {
                    players.push({
                        oldNick: player.nick,
                        currentNick: player.current_nick,
                        id: player.id,
                        userId: BigInt(player.user_id)
                    });
                })
            }
        }

        if (!players.length) {
            return;
        }

        return {
            oldNick,
            players
        }
    }

    static async getPlayerIdByUserId(guildId: bigint, userId: BigInt) {
        const id = await db.execute(`
        SELECT id FROM players
        WHERE guild_id = ? AND user_id = ?
        `, [guildId, userId]);

        if (id[0][0]) {
            return id[0][0].id;
        }

        return null;
    }
}