import db from '../core/db';

export default class TeamModel {
    private constructor() { }

    static async getTeams(guildId: bigint): Promise<{ teamId: string; name: string }[]> {
        const teams: any = await db.execute(`
        SELECT team_id, name FROM teams
        WHERE guild_id = ?
        `, [guildId]);

        if (!teams[0].length) {
            return [];
        }

        return teams[0].map(row => ({ teamId: row.team_id, name: row.name }));
    }

    static async modifyTeams(guildId: bigint, teams: { teamId: string; newName: string }[]) {
        teams.forEach(async team => {
            await db.execute(`INSERT INTO teams ` +
                `VALUES (?, ?, ?) ` +
                `ON DUPLICATE KEY UPDATE name = ?
                `, [guildId, team.teamId, team.newName, team.newName]);
        });
    }
}