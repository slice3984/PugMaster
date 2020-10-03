import express, { json } from 'express';
import Bot from '../core/bot';
import StatsModel from '../models/stats';

const client = Bot.getInstance().getClient();

export default (async (req: express.Request, res: express.Response) => {
    let guildId = req.body.id;
    let playerId = req.body.player;

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

    if (!playerId) {
        return res.status(400).json({
            code: "400",
            status: "no player id provided"
        });
    }

    let parsedId;

    try {
        parsedId = BigInt(playerId);
    } catch (e) {
        return res.status(400).json({
            code: "400",
            status: "player id has to be a numeric string"
        });
    }

    const playerInfo = await StatsModel.getPlayerInfo(BigInt(guildId), parsedId);

    if (!playerInfo) {
        return res.status(400).json({
            code: "404",
            status: "Player not found"
        });
    }

    const playerNicks = await StatsModel.getPlayerNickHistory(BigInt(guildId), parsedId);
    const playedPickupCounts = await StatsModel.getPlayedPickupsForPlayer(BigInt(guildId), parsedId);
    const lastPlayerPickups = await StatsModel.getLastPlayerPickups(BigInt(guildId), parsedId, 10);

    const id = playerInfo.id;
    const name = playerInfo.name;
    const elo = playerInfo.elo;
    const pickupAmount = playedPickupCounts.reduce((prev, curr) => prev += curr.amount, 0);
    const playedPickups = playedPickupCounts.map(pickup => {
        return { name: pickup.name, amount: pickup.amount }
    });
    const lastPickupTimes = playedPickupCounts.map(pickup => {
        return { name: pickup.name, date: pickup.lastgame }
    });
    const lastPickups = lastPlayerPickups;

    const retObj: PlayerInfo = {
        id,
        name,
        previousNames: playerNicks,
        elo,
        pickupAmount,
        playedPickups,
        lastPickupTimes,
        lastPickups
    };

    return res.json(retObj);
});

interface PlayerInfo {
    id: string;
    name: string;
    previousNames: string[];
    elo: number;
    pickupAmount: number;
    playedPickups: { name: string; amount: number }[];
    lastPickupTimes: { name: string; date: Date }[];
    lastPickups: { id: number; name: string; start: Date; isRated: boolean; players: number }[]
}