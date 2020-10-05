import Discord from 'discord.js';
import { ChannelType, PendingPickup } from '../core/types';
import GuildSettings from '../core/guildSettings';
import Bot from '../core/bot';
import db from '../core/db';
import { FieldPacket, RowDataPacket } from 'mysql2';
import { timeEnd } from 'console';

interface BannedPlayer {
    player: string;
    issuer: string;
    ends_at: Date;
    is_warn_ban: number;
    reason: string | null;
    id: number;
    banid: number;
}

export default class GuildModel {
    private constructor() { }

    static async isGuildStored(guildId: bigint): Promise<boolean> {
        const stored = await db.execute(`
        SELECT COUNT(*) AS cnt FROM guilds WHERE guild_id = ?
        `, [guildId]);
        return stored[0][0].cnt;
    }

    static async createGuild(guild: Discord.Guild): Promise<string> {
        const guildId = BigInt(guild.id);
        const name = guild.name;

        await db.execute(`
        INSERT INTO guilds (guild_id, name)
        VALUES (?, ?)
        `, [guildId, name]);
        return name;
    }

    static async isGuildBanned(guildId: bigint): Promise<boolean> {
        const isBanned = await db.execute(`
        SELECT COUNT(*) AS banned FROM banned_guilds WHERE guild_id = ?
        `, [guildId]);
        return isBanned[0][0].banned;
    }

    static async getGuildSettings(guild: Discord.Guild): Promise<GuildSettings> {
        let data: any = await db.execute(`
        SELECT * FROM guilds WHERE guild_id = ?
        `, [guild.id]);

        data = data[0][0];

        let guildChannels = await db.execute(`
        SELECT * FROM guild_channels
        WHERE guild_id = ?
        `, [guild.id]) as RowDataPacket[][];

        let commandSettingsResults = await db.execute(`
            SELECT command_name, value FROM guild_command_settings
            WHERE guild_id = ?
        `, [guild.id]) as RowDataPacket[][];

        const commandSettings = new Map();

        for (const row of commandSettingsResults[0]) {
            let value = Number.isInteger(+row.value) ? +row.value : row.value;
            if (!commandSettings.has(row.command_name)) {
                commandSettings.set(row.command_name, [value]);
            } else {
                commandSettings.get(row.command_name).push(value);
            }
        }

        const channels = new Map();

        guildChannels[0].forEach(channel => {
            channels.set(BigInt(channel.channel_id), channel.channel_type);
        });

        let disabledCommands = await GuildModel.getDisabledCommands(BigInt(guild.id));

        const settings = new GuildSettings(
            guild,
            BigInt(guild.id),
            data.prefix,
            data.global_blacklist_role,
            data.global_whitelist_role,
            data.promotion_delay,
            data.last_promote,
            data.global_expire,
            data.trust_time ? data.trust_time : null,
            data.explicit_trust ? data.explicit_trust : null,
            disabledCommands,
            commandSettings,
            channels,
            data.server_id,
            data.start_message,
            data.sub_message,
            data.notify_message,
            data.iteration_time,
            data.afk_time,
            data.afk_check_iterations,
            data.picking_iterations,
            data.warn_streaks,
            data.warns_until_ban,
            data.warn_streak_expiration,
            data.warn_expiration_time,
            data.warn_ban_time,
            data.warn_ban_time_multiplier
        )

        return settings;
    }

    static async getChannelType(guildId: bigint, channelId: bigint) {
        let type = await db.execute(`
        SELECT channel_type
        FROM guild_channels
        WHERE guild_id = ? AND channel_id = ?
        `, [guildId, channelId]);

        if (type[0][0]) {
            return type[0][0].channel_type;
        }

        return;
    }

    static async createChannel(guildId: bigint, channelId: bigint, type: ChannelType) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        for (const [channelId, channelType] of guildChannels) {
            if (channelType === type) {
                guildChannels.delete(channelId);
                break;
            }
        }

        await db.execute(`
        DELETE FROM guild_channels
        WHERE guild_id = ? AND channel_type = ?
        `, [guildId, type]);

        await db.execute(`
        INSERT INTO guild_channels VALUES(?, ?, ?)
        `, [guildId, channelId, type]);

        guildChannels.set(channelId, type);
    }

    static async updateChannel(guildId: bigint, channelId: bigint, type: ChannelType) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        for (const [channelId, channelType] of guildChannels) {
            if (channelType === type) {
                guildChannels.delete(channelId);
            }
            if (channelId === channelId) {
                guildChannels.set(channelId, type);
            }
        }

        await db.execute(`
        UPDATE guild_channels
        SET channel_type = ?
        WHERE guild_id = ? AND channel_id = ?
        `, [type, guildId, channelId]);
    }

    static async removeChannel(guildId: bigint, channelId: bigint) {
        const guildChannels = Bot.getInstance().getGuild(guildId).channels;
        guildChannels.delete(channelId);

        await db.execute(`
        DELETE FROM guild_channels
        WHERE guild_id = ? AND channel_id = ?
        `, [guildId, channelId]);
    }

    static async getPickupChannel(guildId: bigint) {
        const channel = await db.execute(`
        SELECT channel_id FROM guild_channels
        WHERE guild_id = ? AND channel_type = 'pickup'
        `, [guildId]);

        if (channel[0][0]) {
            return channel[0][0].channel_id;
        } else {
            return null;
        }
    }

    static async getAllExpires(...guildIds) {
        let expires;

        if (guildIds.length === 0) {
            expires = await db.query(`
            SELECT guild_id, player_id, pickup_expire FROM state_guild_player
            WHERE pickup_expire IS NOT NULL
            `);
        } else {
            expires = await db.execute(`
            SELECT guild_id, player_id, pickup_expire FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND pickup_expire IS NOT NULL
            `, guildIds);
        }

        if (!expires[0].length) {
            return [];
        }

        return expires[0].map(expire => {
            return {
                ...expire,
                guild_id: expire.guild_id.toString(),
                player_id: expire.player_id.toString()
            }
        });
    }

    static async getAllAddTimes(...guildIds) {
        let addTimes;

        if (guildIds.length === 0) {
            addTimes = await db.query(`
            SELECT last_add, guild_id, player_id FROM state_guild_player
            WHERE last_add IS NOT NULL
            `);
        } else {
            addTimes = await db.execute(`
            SELECT last_add, guild_id, player_id FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND last_add IS NOT NULL
            `, [...guildIds])
        }

        if (!addTimes[0].length) {
            return [];
        }

        return addTimes[0].map(time => {
            return {
                ...time,
                guild_id: time.guild_id.toString(),
                player_id: time.player_id.toString()
            }
        });
    }

    static async removeAddTimes(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET last_add = null
        WHERE guild_id = ?
        AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
        return;
    }

    static async resetPlayerStates(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player 
        SET pickup_expire = null, pickup_expire = null, last_add = null, is_afk = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async clearUnusedPlayerStates() {
        await db.query(`
        DELETE FROM state_guild_player
        WHERE ao_expire IS NULL AND pickup_expire IS NULL
        AND last_add IS NULL AND is_afk IS NULL
        `);
    }

    static async getAllAos(...guildIds) {
        let aos;

        if (guildIds.length === 0) {
            aos = await db.query(`
            SELECT guild_id, player_id, ao_expire FROM state_guild_player
            WHERE ao_expire IS NOT NULL
            `);
        } else {
            aos = await db.execute(`
            SELECT guild_id, player_id, ao_expire FROM state_guild_player
            WHERE guild_id IN (${Array(guildIds.length).fill('?').join(',')})
            AND ao_expire IS NOT NULL
            `, guildIds);
        }

        if (!aos[0].length) {
            return [];
        }

        return aos[0].map(ao => {
            return {
                ...ao,
                guild_id: ao.guild_id.toString(),
                player_id: ao.player_id.toString()
            }
        });
    }

    static async getAllAddedPlayers(guildId?: BigInt) {
        if (!guildId) {
            const players: any = await db.query(`
            SELECT guild_id, player_id FROM state_pickup_players
            `);

            if (!players[0].length) {
                return [];
            }

            return players[0].map(player => {
                return {
                    guild_id: player.guild_id.toString(),
                    player_id: player.player_id.toString()
                }
            });

        } else {
            const players: any = await db.execute(`
            SELECT player_id FROM state_pickup_players
            WHERE guild_id = ?
            `, [guildId]);

            if (!players[0].length) {
                return []
            }

            return players[0].map(row => row.player_id.toString());
        }
    }

    static async modifyGuild(guildId: bigint, key: string, value: string) {
        let newValue: string | number = value;

        await db.execute(`
        UPDATE guilds SET ${key} = ?
        WHERE guild_id = ?
        `, [newValue, guildId]);
    }

    static async modifyCommand(guildId: bigint, settings: { command: string, values: [] }[]) {
        const commandNames = settings.map(obj => obj.command);
        const toInsert = [];

        settings.forEach(setting => {
            setting.values.forEach(value => {
                toInsert.push(guildId, setting.command, value);
            });
        });

        // Delete possible already stored settings
        await db.execute(`
        DELETE FROM guild_command_settings WHERE guild_id = ?
        AND command_name IN (${Array(commandNames.length).fill('?').join(',')}) 
        `, [guildId, ...commandNames]);

        // Insert new settings
        await db.execute(`
        INSERT INTO guild_command_settings VALUES ${Array(toInsert.length / 3).fill('(?, ?, ?)').join(',')}
        `, [...toInsert]);
    }

    static async disableCommand(guildId: bigint, ...commands) {
        await db.execute(`
        INSERT INTO guild_disabled_commands VALUES ${Array(commands.length).fill('(?, ?)').join(',')}
        `, [guildId, ...commands]);
    }

    static async getDisabledCommands(guildId: bigint) {
        const disabled = await db.execute(`
        SELECT command_name FROM guild_disabled_commands WHERE guild_id = ?
        `, [guildId]) as RowDataPacket[][];

        return disabled[0].map(row => row.command_name);
    }

    static async enableCommand(guildId: bigint, ...commands) {
        await db.execute(`
        DELETE FROM guild_disabled_commands WHERE guild_id = ?
        AND command_name IN (${Array(commands.length).fill('?').join(',')})
        `, [guildId, ...commands]);
    }

    static async getBans(guildId: bigint, mode: 'perms_only' | 'all' | 'timed', limit: number = 10): Promise<BannedPlayer[]> {
        let bans;

        switch (mode) {
            case 'perms_only':
                bans = await db.execute(`
                SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.is_warn_ban, b.reason, p.id, b.id AS banid FROM bans b
                JOIN players p ON b.player_id = p.id
                JOIN players p2 ON b.issuer_player_id = p2.id
                WHERE b.permanent = true AND b.is_active = true 
                AND b.guild_id = ? ORDER BY b.id LIMIT ${limit}
                `, [guildId]);
                break;
            case 'timed':
                bans = await db.execute(`
                SELECT p.current_nick AS player, p2.current_nick AS issuer, b.ends_at, b.is_warn_ban, b.reason, p.id, b.id AS banid FROM bans b
                JOIN players p ON b.player_id = p.id
                JOIN players p2 ON b.issuer_player_id = p2.id
                WHERE b.ends_at > current_timestamp() AND b.is_active = true 
                AND b.guild_id = ? ORDER BY b.ends_at DESC LIMIT ${limit}
                `, [guildId]);
                break;
        }

        return bans[0] as BannedPlayer[];
    }

    static async getWarns(guildId: bigint, limit: number)
        : Promise<{ warns: number, player: string, issuer: string, warned_at: Date, reason: string, id: number, warnid: number }[]> {
        const guildSettings = Bot.getInstance().getGuild(guildId);

        // https://mariadb.com/kb/en/why-is-order-by-in-a-from-subquery-ignored/
        const warns: any = await db.execute(`
        SELECT COUNT(w_temp.id) AS warns,
        w_temp.player,
        MAX(w_temp.issuer) AS issuer,
        MAX(w_temp.warned_at) AS warned_at,
        MAX(w_temp.reason) AS reason,
        w_temp.id, MAX(w_temp.warnid) AS warnid FROM (
            SELECT p.current_nick AS player, p2.current_nick AS issuer, w.warned_at, w.reason, p.id, w.id AS warnid FROM warns w
            JOIN players p ON w.player_id = p.id
            JOIN players p2 ON w.issuer_player_id = p2.id
            WHERE DATE_ADD(w.warned_at, INTERVAL (? / 1000) SECOND) > CURRENT_TIMESTAMP
            AND w.guild_id = ? AND is_active = true
            ORDER BY w.warned_at DESC
            LIMIT 18446744073709551615) AS w_temp
        GROUP BY w_temp.id
        LIMIT ${limit}
        `, [guildSettings.warnExpiration, guildId]);

        return warns[0].reverse();
    }

    static async getPlayersWithNotify(guildId: bigint, ...playerIds): Promise<string[]> {
        const playersWithNotify: any = await db.execute(`
        SELECT user_id FROM players
        WHERE notifications = true
        AND guild_id = ?
        AND user_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);

        return playersWithNotify[0].map(player => player.user_id.toString());
    }

    static async updateLastPromote(guildId: bigint) {
        await db.execute(`
        UPDATE guilds SET last_promote = CURRENT_TIMESTAMP
        WHERE guild_id = ?
        `, [guildId]);
    }

    static async getPendingPickup(guildId: bigint, pickupConfigId: number): Promise<PendingPickup> {
        const data: any = await db.execute(`
        SELECT sp.guild_id, p.current_nick, p.user_id, pc.id, pc.name, pc.player_count, sp.in_stage_since, sp.stage_iteration, sp.stage, st.team
        FROM state_pickup sp
        JOIN state_pickup_players spp ON spp.pickup_config_id = sp.pickup_config_id
        JOIN players p ON p.user_id = spp.player_id AND p.guild_id = spp.guild_id
        JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
        LEFT JOIN state_teams st ON (sp.pickup_config_id = st.pickup_config_id AND spp.player_id = st.player_id)
        WHERE sp.stage != 'fill' AND sp.guild_id = ? AND pc.id = ?
        `, [guildId, pickupConfigId]);

        if (!data[0].length) {
            return null;
        }

        const teams = [];
        const playersLeft = [];
        let amountPlayersAdded = 0;

        data[0].forEach(row => {
            if (row.stage === 'afk_check') {
                if (!teams.length) {
                    teams.push({
                        name: 'A',
                        players: []
                    });
                }
                teams[0].players.push({
                    id: row.user_id.toString(),
                    nick: row.current_nick
                });
            } else {
                if (row.team) {
                    const index = teams.findIndex(team => team.name === row.team);
                    if (index < 0) {
                        teams.push({
                            name: row.team,
                            players: [{
                                id: row.user_id.toString(),
                                nick: row.current_nick
                            }]
                        });

                        amountPlayersAdded++;
                    } else {
                        teams[index].players.push({
                            id: row.user_id.toString(),
                            nick: row.current_nick
                        });

                        amountPlayersAdded++;
                    }
                } else {
                    playersLeft.push({
                        id: row.user_id.toString(),
                        nick: row.current_nick
                    });

                    amountPlayersAdded++;
                }
            }
        });

        return {
            pickupConfigId: data[0][0].id,
            name: data[0][0].name,
            maxPlayers: data[0][0].player_count,
            amountPlayersAdded,
            pendingSince: data[0][0].in_stage_since,
            currentIteration: data[0][0].stage_iteration,
            stage: data[0][0].stage,
            // @ts-ignore
            teams,
            // @ts-ignore
            playersLeft
        }
    }

    static async getPendingPickups(...guildIds: bigint[]): Promise<Map<string, PendingPickup[]>> {
        const data: any = await db.execute(`
        SELECT sp.guild_id, p.current_nick, p.user_id, pc.id, pc.name, pc.player_count, sp.in_stage_since, sp.stage_iteration, sp.stage, st.team
        FROM state_pickup sp
        JOIN state_pickup_players spp ON spp.pickup_config_id = sp.pickup_config_id
        JOIN players p ON p.user_id = spp.player_id AND p.guild_id = spp.guild_id
        JOIN pickup_configs pc ON sp.pickup_config_id = pc.id
        LEFT JOIN state_teams st ON (sp.pickup_config_id = st.pickup_config_id AND spp.player_id = st.player_id)
        WHERE sp.guild_id IN (${Array(guildIds.length).fill('?').join(',')})
        AND sp.stage != 'fill'
        ORDER BY sp.in_stage_since
        `, guildIds);

        if (!data[0].length) {
            return null;
        }

        console.log(data[0])

        const guilds = new Map();
        data[0].forEach(row => {
            const guildId = row.guild_id.toString();

            if (!guilds.has(guildId)) {
                guilds.set(guildId, [{
                    pickupConfigId: row.id,
                    name: row.name,
                    maxPlayers: row.player_count,
                    amountPlayersAdded: 0,
                    pendingSince: row.in_stage_since,
                    currentIteration: row.stage_iteration,
                    stage: row.stage,
                    teams: [],
                    playersLeft: []
                }]);
            }

            const guildRef = guilds.get(BigInt(row.guild_id));
            let pickupIndex = guildRef.findIndex(pickup => pickup.pickupConfigId === row.id);

            if (pickupIndex < 0) {
                guildRef.push({
                    pickupConfigId: row.id,
                    name: row.name,
                    maxPlayers: row.player_count,
                    amountPlayersAdded: 0,
                    pendingSince: row.in_stage_since,
                    currentIteration: row.stage_iteration,
                    stage: row.stage,
                    teams: [],
                    playersLeft: []
                });
                pickupIndex = guildRef.length - 1;
            }

            const pickup = guildRef[pickupIndex];

            if (row.stage === 'afk_check') {
                if (!pickup.teams.length) {
                    pickup.teams.push({
                        name: 'A',
                        players: []
                    });
                }
                pickup.teams[0].players.push({
                    id: row.user_id.toString(),
                    nick: row.current_nick
                });

                pickup.amountPlayersAdded++;
            } else {
                if (row.team) {
                    const index = pickup.teams.findIndex(team => team.name === row.team);
                    if (index < 0) {
                        pickup.teams.push({
                            name: row.team,
                            players: [{
                                id: row.user_id.toString(),
                                nick: row.current_nick
                            }]
                        });

                        pickup.amountPlayersAdded++;
                    } else {
                        pickup.teams[index].players.push({
                            id: row.user_id.toString(),
                            nick: row.current_nick
                        });

                        pickup.amountPlayersAdded++;
                    }
                } else {
                    pickup.playersLeft.push({
                        id: row.user_id.toString(),
                        nick: row.current_nick
                    });

                    pickup.amountPlayersAdded++;
                }
            }
        });

        return guilds;
    }

    static async setAfks(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET is_afk = true
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }

    static async removeAfks(guildId: bigint, ...playerIds) {
        await db.execute(`
        UPDATE state_guild_player SET is_afk = null
        WHERE guild_id = ? AND player_id IN (${Array(playerIds.length).fill('?').join(',')})
        `, [guildId, ...playerIds]);
    }
}