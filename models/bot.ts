import db from '../core/db';

export default class BotModel {
    private constructor() { }

    static async getStoredCommands() {
        const storedCommands = await db.query(`
        SELECT * FROM commands
        `);

        return storedCommands[0];
    }

    static async storeCommands(...names) {
        for (const name of names) {
            await db.query(`
            INSERT INTO commands VALUES('${name}', 0)
            `);
        }
        return;
    }

    static async removeCommands(...names) {
        for (const name of names) {
            await db.query(`
            DELETE FROM commands WHERE name = '${name}'
            `);
        }
        return;
    }
}