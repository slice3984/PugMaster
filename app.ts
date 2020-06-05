import Bot from './core/bot';
import ConfigTool from './core/configTool';
import { checkDb, createTables } from './core/dbInit';

(async () => {
    // Config check
    const configExists = await ConfigTool.doesConfigExist();
    if (!configExists) {
        console.error('Config file not found');
        await ConfigTool.generateConfig();
        console.log('Generated config.json, please edit this file and start the bot again.');
        process.exit(0);
    }

    // Db check
    if (await checkDb()) {
        console.log(`Found tables in database ${ConfigTool.getConfig().db.db}`);
    } else {
        console.log(`Empty database, creating tables`);
        await createTables();
        console.log('Tables successfully created');
    }

    // Starting discord bot
    Bot.getInstance();
})();