import db from '../core/db';

export default class PermissionModel {
    private constructor() { }

    static async getRoleCommandPermissions(guildId: bigint, roleId: bigint) {
        const roles = await db.query(`
        SELECT command_name FROM guild_roles
        JOIN guild_role_command_permissions
        ON role_id = guild_role_id
        WHERE guild_id = ${guildId} AND role_id = ${roleId}
        `);


        if (roles[0].length > 0) {
            return roles[0].map(command => command.command_name);
        }

        return roles[0];
    }

    static async isGuildRoleStored(guildId: bigint, roleId: bigint) {
        const stored = await db.query(`
            SELECT COUNT(*) as cnt FROM guild_roles
            WHERE guild_id = ${guildId} AND role_id = ${roleId}
        `);

        return stored[0][0].cnt;
    }

    static async storeGuildRole(guildId: bigint, roleId: bigint) {
        await db.query(`
        INSERT INTO guild_roles VALUES(${guildId}, ${roleId});
        `);

        return;
    }

    static async addGuildRoleCommandPermissions(roleId: bigint, ...commands) {
        for (const command of commands) {
            await db.query(`
            INSERT INTO guild_role_command_permissions
            VALUES (${roleId}, '${command}')
            `);
        }
        return;
    }

    static async removeGuildRoleCommandPermission(roleId: bigint, ...commands) {
        for (const command of commands) {
            await db.query(`
            DELETE FROM guild_role_command_permissions
            WHERE guild_role_id = ${roleId} AND command_name = '${command}' 
            `);
        }
        return;
    }

    static async guildRolesGotCommandPermission(guildId: bigint, command: string, ...roleIds: bigint[]) {
        const roleList = roleIds.map(roleId => `'${roleId}'`);

        const gotPermission = await db.query(`
        SELECT COUNT(*) as cnt FROM guild_roles
        JOIN guild_role_command_permissions ON role_id = guild_role_id
        WHERE guild_id = ${guildId} AND role_id IN (${roleList.join(', ')}) AND command_name = '${command}'
        `);

        return gotPermission[0][0].cnt;
    }
}