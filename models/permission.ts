import db from '../core/db';

export default class PermissionModel {
    private constructor() { }

    static async getRoleCommandPermissions(guildId: bigint, ...roleIds: bigint[]) {
        console.log(roleIds.join(', '))
        const roles = await db.execute(`
        SELECT DISTINCT command_name FROM guild_roles
        JOIN guild_role_command_permissions
        ON role_id = guild_role_id
        WHERE guild_id = ? AND role_id IN (${Array(roleIds.length).fill('?').join(',')})
        `, [guildId, ...roleIds]);


        if (roles[0].length > 0) {
            return roles[0].map(command => command.command_name);
        }

        return roles[0];
    }

    static async isGuildRoleStored(guildId: bigint, roleId: bigint) {
        const stored = await db.execute(`
            SELECT COUNT(*) as cnt FROM guild_roles
            WHERE guild_id = ? AND role_id = ?
        `, [guildId, roleId]);

        return stored[0][0].cnt;
    }

    static async storeGuildRole(guildId: bigint, roleId: bigint) {
        await db.execute(`
        INSERT INTO guild_roles VALUES(?, ?);
        `, [guildId, roleId]);

        return;
    }

    static async addGuildRoleCommandPermissions(roleId: bigint, ...commands) {
        for (const command of commands) {
            await db.execute(`
            INSERT INTO guild_role_command_permissions
            VALUES (?, ?)
            `, [roleId, command]);
        }
        return;
    }

    static async removeGuildRoleCommandPermission(roleId: bigint, ...commands) {
        for (const command of commands) {
            await db.execute(`
            DELETE FROM guild_role_command_permissions
            WHERE guild_role_id = ? AND command_name = ?
            `, [roleId, command]);
        }
        return;
    }

    static async guildRolesGotCommandPermission(guildId: bigint, command: string, ...roleIds: bigint[]) {
        const gotPermission = await db.execute(`
        SELECT COUNT(*) as cnt FROM guild_roles
        JOIN guild_role_command_permissions ON role_id = guild_role_id
        WHERE guild_id = ? AND role_id IN (${Array(roleIds.length).fill('?').join(',')}) AND command_name = ?
        `, [guildId, ...roleIds, command]);

        return gotPermission[0][0].cnt;
    }
}