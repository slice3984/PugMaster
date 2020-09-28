import express from 'express';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    let guildId = req.body.id;
    let page = req.body.page;
    let by = req.body.by;
    let desc = req.body.desc;

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

    if (!page) {
        return res.status(400).json({
            code: "400",
            status: "no page number provided"
        });
    }

    if (!Number.isInteger(+page)) {
        return res.status(400).json({
            code: "400",
            status: "no integer provided as page number"
        });
    } else {
        page = +page;
    }

    if (page > 10000 || page < 1) {
        return res.status(400).json({
            code: "400",
            status: "page number out of range has to be > 0 < 10000"
        });
    }

    if (!by) {
        return res.status(400).json({
            code: "400",
            status: "no order field provided"
        });
    }

    if (typeof by !== 'string' || !['date', 'gt', 'count'].includes(by.toLowerCase())) {
        return res.status(400).json({
            code: "400",
            status: "order field has to be date, gt or count"
        });
    }

    if (!desc) {
        return res.status(400).json({
            code: "400",
            status: "no sorting order provided"
        });
    }

    if (!['0', '1'].includes(desc.toString())) {
        return res.status(400).json({
            code: "400",
            status: "sorting order has to be 0 or 1"
        });
    }

    switch (by.toLowerCase()) {
        case 'date':
            by = 'p.started_at';
            break;
        case 'gt':
            by = 'pc.name';
            break;
        case 'count':
            by = 'pc.player_count';
    }

    desc = desc.toString() === '1' ? true : false;

    const startAt = (page - 1) * 10;
    const pickups = await StatsModel.getPickups(BigInt(guildId), by, desc, startAt, 10);

    res.json(pickups);
});