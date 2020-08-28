import path from 'path';

import express from 'express';
import Bot from './core/bot';
import ConfigTool from './core/configTool';

import { checkDb, createTables } from './core/dbInit';

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

(async () => {
    // Config check
    const configExists = await ConfigTool.doesConfigExist();
    if (!configExists) {
        console.error('Config file not found');
        await ConfigTool.generateConfig();
        console.log('Generated config.json, please edit this file and start the bot again.');
        process.exit(0);
    } else {
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

        // Web frontend & Backend
        if (process.env.DEBUG) {
            app.disable('view cache');
            app.use('/www/homepage', express.static(path.join(__dirname, 'dist', 'www', 'homepage')));
            app.use('/www/webinterface', express.static(path.join(__dirname, 'dist', 'www', 'webinterface')));
        } else {
            app.use('/www/homepage', express.static(path.join(__dirname, 'www', 'homepage')));
            app.use('/www/webinterface', express.static(path.join(__dirname, 'www', 'webinterface')));
        }

        app.get('/', (req: express.Request, res: express.Response) => {
            res.render('pages/homepage', {
                liveReload: process.env.DEBUG
            });
        });

        app.get('/webinterface', (req: express.Request, res: express.Response) => {
            res.render('pages/webinterface', {
                liveReload: process.env.DEBUG
            })
        });

        app.listen(8080);
    }
})();