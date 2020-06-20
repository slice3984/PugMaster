import db from '../core/db';

export default class ServerModel {
    private constructor() { }

    static async isServerStored(guildId: bigint, name: string): Promise<boolean> {
        const stored = await db.execute(`
        SELECT COUNT(*) AS cnt FROM pickup_servers
        WHERE guild_id = ? AND name = ?
        `, [guildId, name]);

        return stored[0][0].cnt;
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

    static async getServers(guildId: bigint) {
        const servers = await db.execute(`
        SELECT name, ip, password FROM pickup_servers
        WHERE guild_id = ? ORDER BY name
        `, [guildId]);

        return servers[0];
    }

    static async getServer(guildId: bigint, name) {
        const server = await db.execute(`
        SELECT name, ip, password FROM pickup_servers
        WHERE guild_id = ? AND name = ?
        `, [guildId, name]);

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
        `, [guildId, ...server]);

        return ids[0].map(row => row.id);
    }

    static async removeServers(guildId: bigint, ...servers) {
        const serverIds = await ServerModel.getServerIds(guildId, ...servers);

        await db.execute(`
        DELETE FROM pickup_servers WHERE guild_id = ?
        AND id IN (${Array(serverIds.length).fill('?').join(',')})
        `, [guildId, ...serverIds]);

        // Update pickups
        await db.execute(`
        UPDATE pickup_configs SET server_id = null
        WHERE guild_id = ? AND server_id IN (${Array(serverIds.length).fill('?').join(',')})
        `, [guildId, ...serverIds]);
    }
}