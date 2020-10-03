import express from 'express';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    let guildId = req.body.id;
    let searchQuery = req.body.search;

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

    if (!searchQuery) {
        return res.status(400).json({
            code: "400",
            status: "no search query provided"
        });
    }

    if (!searchQuery.length || searchQuery.length > 32) {
        return res.status(400).json({
            code: "400",
            status: "search query has to be between 0 - 33 chars"
        });
    }

    const matches = await StatsModel.searchPlayer(BigInt(guildId), searchQuery, 6);

    const results = {
        status: 'success',
        sent: matches.length > 5 ? 5 : matches.length,
        matchesLeft: matches.length > 5 ? true : false,
        matches: matches.length > 5 ? matches.slice(0, 5) : matches
    }

    res.json(results);
});