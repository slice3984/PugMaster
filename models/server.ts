import { RowDataPacket } from 'mysql2';
import db, { transaction } from '../core/db';

interface ServerType {
    name: string;
    ip: string;
    password: null | string;
}

export default class ServerModel {
    private constructor() { }

    static async isServerStored(guildId: bigint, ...names): Promise<{ id: number; name: string }[]> {
        const stored: any = await db.execute(`
        SELECT id, name FROM pickup_servers
        WHERE guild_id = ? AND name IN (${Array(names.length).fill('?').join(',')})
        `, [guildId, ...names]);

        return stored[0].map(row => {
            return {
                id: row.id,
                name: row.name
            }
        });
    }

    static async addServer(guildId: bigint, name: string, ip: string, password?: string) {
        if (password) {
            await db.execute(`
            INSERT INTO pickup_servers (guild_id, name, ip, password)
            VALUES (?, ?, ?, ?)
            `, [guildId, name, ip, password]);
        } else {
            await db.execute(`
            INSERT INTO pickup_servers (guild_id, name, ip)
            VALUES (?, ?, ?)
            `, [guildId, name, ip]);
        }
    }

    static async getServers(guildId: bigint): Promise<ServerType[]> {
        const servers = await db.execute(`
        SELECT name, ip, password FROM pickup_servers
        WHERE guild_id = ? ORDER BY name
        `, [guildId]);

        return servers[0] as ServerType[];
    }

    static async getServer(guildId: bigint, identifier: string | number) {
        let server;

        if (typeof identifier === 'string') {
            server = await db.execute(`
            SELECT name, ip, password FROM pickup_servers
            WHERE guild_id = ? AND name = ?
            `, [guildId, identifier]);
        } else {
            server = await db.execute(`
            SELECT name, ip, password FROM pickup_servers
            WHERE guild_id = ? AND id = ?
            `, [guildId, identifier]);
        }

        return server[0][0];
    }

    static async modifyServer(guildId: bigint, name, property, value) {
        await db.execute(`
        UPDATE pickup_servers SET ${property} = ?
        WHERE guild_id = ? AND name = ?
        `, [value, guildId, name]);
    }

    static async getServerIds(guildId: bigint, ...server) {
        const ids = await db.execute(`
        SELECT id FROM pickup_servers WHERE guild_id = ?
        AND name IN (${Array(server.length).fill('?').join(',')})
        `, [guildId, ...server]) as RowDataPacket[];

        return ids[0].map(row => row.id);
    }

    static async removeServers(guildId: bigint, ...servers) {
        const serverIds = await ServerModel.getServerIds(guildId, ...servers);

        await transaction(db, async (db) => {
            await db.execute(`
            DELETE FROM pickup_servers WHERE guild_id = ?
            AND id IN (${Array(serverIds.length).fill('?').join(',')})
            `, [guildId, ...serverIds]);

            // Update pickups
            await db.execute(`
            UPDATE pickup_configs SET server_id = null
            WHERE guild_id = ? AND server_id IN (${Array(serverIds.length).fill('?').join(',')})
            `, [guildId, ...serverIds]);

            // Update guild
            await db.execute(`
            UPDATE guilds SET server_id = null
            WHERE guild_id = ? AND server_id IN (${Array(serverIds.length).fill('?').join(',')})
            `, [guildId, ...serverIds]);
        });
    }
}