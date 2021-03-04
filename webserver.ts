import path from 'path';
import http from 'http';
import express from 'express';
import rateLimit from 'express-rate-limit';
import DevPage from './devpage';
import Bot from './core/bot';
import ConfigTool from './core/configTool';
import apiRoutes from './routes/api/index';
const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

const port = ConfigTool.getConfig().webserver.port;

export default (bot: Bot) => {
    app.use('/', express.static(path.join(__dirname, 'www')));
    app.get('*', (req: express.Request, res: express.Response) => {
        res.sendFile(path.join(__dirname, 'www'));
    });

    if (process.env.DEBUG) {
        new DevPage(server, app, bot);
    }

    // Rate limit the API
    app.use('/api/', rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 250,
        keyGenerator: (req) => {
            return req.ip;
        },
        draft_polli_ratelimit_headers: true,
        headers: true,
    }));

    // API
    app.use('/api/', apiRoutes);

    server.listen(port);
    console.log(`Started webserver on port ${port}`)
}