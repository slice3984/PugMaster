import path from 'path';
import express from 'express';
import Bot from './core/bot';
import ConfigTool from './core/configTool';
import routes from './routes/website/index';

const app = express();
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

const port = ConfigTool.getConfig().webserver.port;

export default (bot: Bot) => {
    if (process.env.DEBUG) {
        app.disable('view cache');
        app.use('/www/homepage', express.static(path.join(__dirname, 'dist', 'www', 'homepage')));
        app.use('/www/webinterface', express.static(path.join(__dirname, 'dist', 'www', 'webinterface')));
    } else {
        app.use('/www/homepage', express.static(path.join(__dirname, 'www', 'homepage')));
        app.use('/www/webinterface', express.static(path.join(__dirname, 'www', 'webinterface')));
    }

    app.get('/webinterface', (req: express.Request, res: express.Response) => {
        res.render('pages/webinterface', {
            liveReload: process.env.DEBUG
        })
    });

    // Routes
    app.get('/', routes.home);
    app.get('/stats', routes.stats);
    app.get('/commands', routes.commands);
    app.get('/help', routes.help);
    app.get('/login', routes.login);

    app.listen(port);
    console.log(`Started webserver on port ${port}`)
}