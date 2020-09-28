import express from 'express';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    let guildId = req.body.id;
    let pickupId = req.body.pickup;

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

    if (!pickupId) {
        return res.status(400).json({
            code: "400",
            status: "no pickup id provided"
        });
    }

    if (!Number.isInteger(+pickupId)) {
        return res.status(400).json({
            code: "400",
            status: "no integer provided as pickup id"
        });
    } else {
        pickupId = +pickupId;
    }

    if (pickupId > 1000000 || pickupId < 1) {
        return res.status(400).json({
            code: "400",
            status: "pickup id out of range has to be > 0 < 1000000"
        });
    }

    const data = await StatsModel.getPickupInfo(BigInt(guildId), +pickupId);

    res.json(data);
});
