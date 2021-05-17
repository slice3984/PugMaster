import db from '../core/db';

interface CommandInfo {
    name: string;
    disabled: number;
}

export default class BotModel {
    private constructor() { }

    static async getStoredCommands(): Promise<CommandInfo[]> {
        const storedCommands = await db.query(`
        SELECT * FROM commands
        `);

        return storedCommands[0] as CommandInfo[];
    }

    static async storeCommands(...names) {
        for (const name of names) {
            await db.execute(`
            INSERT INTO commands VALUES(?, 0)
            `, [name]);
        }
        return;
    }

    static async removeCommands(...names) {
        for (const name of names) {
            await db.execute(`
            DELETE FROM commands WHERE name = ?
            `, [name]);
        }
        return;
    }

    static async getAmountOfPendingPickups(): Promise<{ guilds: number; amount: number }> {
        const data: any = await db.execute(`
        SELECT COUNT(*) AS amount from state_pickup
        WHERE stage != 'fill'
        GROUP BY guild_id
        `);

        if (!data[0].length) {
            return null;
        }

        let guilds = 0;
        let amount = 0;

        data[0].forEach(row => {
            guilds++;
            amount += row.amount;
        });

        return { guilds, amount };
    }
}