import express from 'express';
import { GuildInfo } from '../core/types';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    const guildId = req.body.id;

    if (!guildId) {
        const returnObj: GuildInfo = {
            status: 'fail',
            gotData: false,
        };

        return res.status(400).json(returnObj);
    }

    const guildObj = client.guilds.cache.get(guildId);

    if (!guildObj) {
        const returnObj: GuildInfo = {
            status: 'fail',
            gotData: false,
        };

        return res.status(404).json(returnObj);
    }

    const lastGame = await StatsModel.getLastGame(BigInt(guildId));

    // Guild known but no pickup history
    if (!lastGame) {
        const returnObj: GuildInfo = {
            status: 'success',
            gotData: false,
            guildIcon: guildObj.iconURL({ format: 'png' }),
            guildName: guildObj.name,
            guildId: guildObj.id,
            memberCount: guildObj.memberCount
        };

        return res.json(returnObj);
    }

    const pickupPlayers = await StatsModel.getPlayerCount(BigInt(guildId));
    let pickupStats = await StatsModel.getStats(BigInt(guildId));
    const topPlayers = await StatsModel.getTop(BigInt(guildId), 'alltime', 10);
    const pickupDates = await StatsModel.getLastPickupDates(BigInt(guildId), 30);
    const overallPlayedPickups = pickupStats.reduce((val, current) => val + current.amount, 0);

    // Limit to max 10 pickups
    if (pickupStats.length > 10) {
        const leftPickups = pickupStats.splice(9);
        const amount = leftPickups.reduce((val, curr) => val + curr.amount, 0);
        pickupStats.push({ name: 'other', amount });
    }

    const returnObj: GuildInfo = {
        status: 'success',
        gotData: true,
        guildIcon: guildObj.iconURL({ format: 'png' }),
        guildName: guildObj.name,
        guildId: guildObj.id,
        memberCount: guildObj.memberCount,
        pickupPlayerCount: pickupPlayers,
        pickupCount: overallPlayedPickups,
        lastGame: { date: lastGame.startedAt, name: lastGame.name },
        pickupsChartData: pickupStats,
        topPlayersChartData: topPlayers,
        activityTimesChartData: pickupDates
    };

    return res.json(returnObj);
});