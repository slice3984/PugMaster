import express from 'express';
import Bot from '../core/bot';

const client = Bot.getInstance().getClient();

export default ((req: express.Request, res: express.Response) => {
    let guilds = req.body.guilds as [];

    if (!guilds) {
        return res.status(400).json({
            code: "400",
            status: "no guild ids provided"
        });
    }

    if (!Array.isArray(guilds)) {
        return res.status(400).json({
            code: "400",
            status: "no guild array provided"
        });
    }

    const info = [];

    let matches = 0;

    for (const guildId of guilds) {
        const guild = client.guilds.cache.get(guildId);

        if (guild) {
            matches++;
            info.push({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL({ extension: 'png' })
            })
        }

        // Only allow upto 6 favorites
        if (matches >= 6) {
            break;
        }
    }

    if (info.length) {
        res.json({
            status: 'success',
            guilds: info
        });
    } else {
        res.json({
            status: 'no guilds found',
            guilds: []
        })
    }



});