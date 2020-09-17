import express from 'express';
import Bot from '../core/bot';

const client = Bot.getInstance().getClient();

export default ((req: express.Request, res: express.Response) => {
    const connectedGuilds = client.guilds.cache.map(guild => {
        return {
            id: guild.id,
            name: guild.name,
            icon: guild.iconURL({ format: 'png' })
        }
    });

    const query = req.body.query;

    if (!query) {
        return res.status(404).json({
            code: "400",
            status: 'no query provided'
        });
    }

    const matches = connectedGuilds.filter(guild => (guild.id.includes(query) || guild.name.toLowerCase().includes(query.toLowerCase())));

    const results = {
        status: 'success',
        sent: matches.length > 3 ? 3 : matches.length,
        left: matches.length > 3 ? matches.length - 3 : 0,
        matches: matches.length > 3 ? matches.slice(0, 3) : matches
    }

    res.json(results);
});
