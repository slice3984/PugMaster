import express from 'express';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    let guildId = req.body.id;

    if (!guildId) {
        return res.status(400).json({
            code: "400",
            status: "no guild id provided"
        });
    }

    const guildObj = client.guilds.cache.get(guildId);

    if (!guildObj) {
        return res.status(404).json({
            code: "400",
            status: "guild not found"
        });
    }

    const count = await StatsModel.getPickupCount(BigInt(guildId));

    res.json({ amount: count });
});