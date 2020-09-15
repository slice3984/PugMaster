import path from 'path';
import express from 'express';
import rateLimit from 'express-rate-limit';
import Bot from './core/bot';
import ConfigTool from './core/configTool';
import routes from './routes/website/index';
import apiRoutes from './routes/api/index';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('trust proxy', 1);

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

    // Rate limit the API
    app.use('/api/', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 100,
        keyGenerator: (req) => {
            return req.ip;
        },
        draft_polli_ratelimit_headers: true,
        headers: true,
    }));

    // API
    app.use('/api/', apiRoutes);

    app.listen(port);
    console.log(`Started webserver on port ${port}`)
}