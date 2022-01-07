import Discord from 'discord.js';
import * as ts from 'ts-trueskill';
import PickupModel from '../models/pickup';
import RatingModel from "../models/rating";
import Bot from './bot';
import ConfigTool from './configTool';
import { RatingPickup, RateablePickup, RatingTeam } from "./types";
import Util from './util';
import { Util as DjsUtil } from 'discord.js';

interface UpdateData {
    pickups: PlayerRating[],
    playerRatings: { id: bigint, mu: number, sigma: number }[],
}

interface RatingResult {
    id: string;
    amountGames: number;
    prevMu: number;
    prevSigma: number;
    newMu: number;
    newSigma: number;
}[]

interface PlayerRating {
    pickupId: number;
    players: { id: bigint, mu: number, sigma: number }[]
}

export default class Rating {
    // Rerating a lot pickups can take a long time, limit it
    static RERATE_AMOUNT_LIMIT = 10;

    private static async generateRatings(
        guildId: string,
        pickupToRate: RateablePickup,
        amountFollowingPickups: number,
        unrate: boolean): Promise<UpdateData> {
        const updateData: UpdateData = {
            pickups: [],
            playerRatings: []
        };

        let pickupRatings: RatingPickup[] = [];

        let playerIds: any = new Set();

        // Player ids of the given pickup
        pickupToRate.teams
            .flatMap(p => p.players.map(p2 => p2.id))
            .forEach(playerIds.add, playerIds);

        // Newer pickups have to be rerated, get pickups following after this one
        if (amountFollowingPickups > 0) {
            pickupRatings = await RatingModel.getLatestRatedPickups(BigInt(guildId), pickupToRate.pickupConfigId, amountFollowingPickups);

            // We also need the ids of players who played in following pickups to update their rating correct
            pickupRatings.forEach(pickup => {
                pickup.teams.flatMap(p => p.players.map(p2 => p2.id))
                    .forEach(playerIds.add, playerIds);
            })
        }

        playerIds = Array.from(playerIds);

        // Get newest ratings before this pickup, required for the rerating of following pickups
        const skills = await RatingModel.getPreviousNewestRatings(BigInt(guildId), pickupToRate.pickupId, pickupToRate.pickupConfigId, ...playerIds.map(id => BigInt(id)));

        // No need to generate a new rating pickup object in case of unrating
        if (!unrate) {
            const ratingObj: RatingPickup = {
                pickupId: pickupToRate.pickupId,
                teams: []
            };

            pickupToRate.teams.forEach(team => {
                const t = {
                    team: team.name,
                    outcome: team.outcome,
                    players: []
                } as unknown as RatingTeam;

                team.players.forEach(player => {
                    const retrievedRating = skills.find(rating => rating.id === player.id)

                    t.players.push({
                        id: player.id,
                        rating: retrievedRating ? new ts.Rating(retrievedRating.mu, retrievedRating.sigma) : new ts.Rating()
                    });
                });
                ratingObj.teams.push(t);
            });

            pickupRatings.push(ratingObj);
        }

        // Start from earliest, also important for the rerating part later
        pickupRatings = pickupRatings.sort((p1, p2) => p1.pickupId - p2.pickupId);

        const calculatedRatings: Map<string, ts.Rating> = new Map();

        skills.forEach(rating => {
            calculatedRatings.set(rating.id, new ts.Rating(rating.mu, rating.sigma));
        });

        pickupRatings.forEach(pickupRating => {
            // Make sure to always use the newest ratings
            pickupRating.teams.flatMap(t => t.players).forEach(p => {
                const prevRating = calculatedRatings.get(p.id);

                if (prevRating) {
                    p.rating = prevRating;
                }
            });

            const ratingArr = pickupRating.teams.map(t => t.players.map(p => p.rating));

            const outcomes = pickupRating.teams.map(t => {
                switch (t.outcome) {
                    case 'win':
                        return -1;
                    case 'draw':
                        return 0;
                    case 'loss':
                        return 1;
                }
            });

            // trueskill rating
            const computedValues = ts.rate(ratingArr, outcomes);

            // Update ratings map to keep newest values
            const ratedPlayersIds = pickupRating.teams.flatMap(t => t.players.map(p => p.id));
            const ratedPlayerSkills = computedValues.flat();
            const playerObjs: { id: bigint, mu: number, sigma: number }[] = [];

            ratedPlayersIds.forEach((id, idx) => {
                const rating = ratedPlayerSkills[idx];

                calculatedRatings.set(id, rating);

                // Required to keep a history of old skill ratings for players
                playerObjs.push({
                    id: BigInt(id),
                    mu: rating.mu,
                    sigma: rating.sigma
                });
            });

            // player ratings
            updateData.pickups.push({
                pickupId: pickupRating.pickupId,
                players: playerObjs
            });
        });

        const playerRatings: { id: bigint, mu: number, sigma: number }[] = [];

        // Add possible missing players without ratings
        playerIds.forEach(id => {
            const rating = calculatedRatings.get(id);

            if (!rating) {
                playerRatings.push({
                    id,
                    mu: null,
                    sigma: null
                })
            } else {
                playerRatings.push({
                    id,
                    mu: rating.mu,
                    sigma: rating.sigma
                })
            }
        });

        updateData.playerRatings = playerRatings;
        return updateData;
    }

    static async rateMatch(guildId: string, pickupToRate: RateablePickup) {
        const amountFollowingPickups = await RatingModel.getAmountOfFollowingPickups(BigInt(guildId), pickupToRate.pickupConfigId, pickupToRate.pickupId);

        if (amountFollowingPickups > Rating.RERATE_AMOUNT_LIMIT) {
            return Util.formatMessage('error', `It is only possible to ${pickupToRate.isRated ? 'rerate' : 'rate'} up to ${this.RERATE_AMOUNT_LIMIT} proceeding rated pickups of the same kind`);
        }

        const updateData = await this.generateRatings(guildId, pickupToRate, amountFollowingPickups, false);

        const outcomes = pickupToRate.teams.map(t => {
            return {
                team: t.name,
                result: t.outcome
            }
        });

        const message = await this.generateRatingMessage(guildId, pickupToRate, outcomes, updateData.playerRatings);
        await RatingModel.rate(BigInt(guildId), pickupToRate.pickupId, pickupToRate.pickupConfigId, outcomes, updateData.pickups);
        return message;
    }

    static async unrateMatch(guildId: string, pickupToUnrate: RateablePickup): Promise<Discord.MessageEmbed | string> {
        // If the latest rated pickup is the one being unrated there is no need to generate new ratings
        const amountFollowingPickups = await RatingModel.getAmountOfFollowingPickups(BigInt(guildId), pickupToUnrate.pickupConfigId, pickupToUnrate.pickupId);

        if (amountFollowingPickups > Rating.RERATE_AMOUNT_LIMIT) {
            return Util.formatMessage('error', `It is only possible to unrate up to ${this.RERATE_AMOUNT_LIMIT} proceeding rated pickups of the same kind`);
        }

        const playerIds = pickupToUnrate.teams.flatMap(p => p.players.map(p2 => BigInt(p2.id)));
        if (!amountFollowingPickups) {
            const playerRatings: { id: bigint, mu: number | null, sigma: number | null }[] = [];

            const previousKnownRatings = await RatingModel.getPreviousNewestRatings(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, ...playerIds);

            playerIds.forEach(id => {
                const prevRating = previousKnownRatings.find(rating => BigInt(rating.id) === id);
                playerRatings.push({
                    id,
                    mu: prevRating ? prevRating.mu : null,
                    sigma: prevRating ? prevRating.sigma : null
                });
            });

            const message = this.generateRatingMessage(guildId, pickupToUnrate, null, playerRatings);
            await RatingModel.unrate(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, [], playerRatings);
            return message;
        } else {
            const updateData = await this.generateRatings(guildId, pickupToUnrate, amountFollowingPickups, true);
            const message = this.generateRatingMessage(guildId, pickupToUnrate, null, updateData.playerRatings);
            await RatingModel.unrate(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, updateData.pickups, updateData.playerRatings);
            return message;
        }
    }

    private static async generateRatingMessage(guildId: string,
        pickup: RateablePickup,
        outcomes: { team: string; result: "win" | "draw" | "loss" }[], newRatings: { id: bigint, mu: number, sigma: number }[]): Promise<Discord.MessageEmbed | string> {
        const players = pickup.teams.flatMap(p => p.players.map(p2 => ({ id: BigInt(p2.id), nick: p2.nick })));
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guildId), pickup.pickupConfigId);

        // Only display rating changes for pickups with less than 11 players
        if (players.length > 10) {
            if (outcomes) {
                const results = outcomes.map(o => {
                    const team = pickup.teams.find(t => t.name === o.team).alias || o.team;
                    return `Team **${team}** - **${o.result.toUpperCase()}**`;
                }).join(' / ');
                return Util.formatMessage('success', `${pickup.isRated ? 'Rerated' : 'Rated'} pickup **#${pickup.pickupId}** - **${pickup.name}**: ${results}`);
            } else {
                return Util.formatMessage('success', `Unrated pickup **#${pickup.pickupId}** - **${pickup.name}**`);
            }
        }

        const guildSettings = Bot.getInstance().getGuild(guildId);
        const emojis = ConfigTool.getConfig().emojis;

        const currentRatings = await RatingModel.getCurrentRatings(pickup.pickupConfigId, ...players.map(p => p.id));
        const results: RatingResult[] = [];

        newRatings.forEach(rating => {
            const oldRating = currentRatings.find(r => r.id === rating.id.toString());
            results.push({
                id: rating.id.toString(),
                amountGames: oldRating ? oldRating.amount : 0,
                newMu: rating.mu,
                newSigma: rating.sigma,
                prevMu: oldRating ? oldRating.mu : null,
                prevSigma: oldRating ? oldRating.sigma : null,
            })
        });

        const rankCap = pickupSettings.maxRankRatingCap || guildSettings.maxRankRatingCap;
        const playerNicks = [];
        const from = [];
        const to = [];

        players.forEach(p => {
            const result = results.find(r => r.id === p.id.toString());
            const amountAfter = outcomes ? result.amountGames - 1 : result.amountGames + 1; // Can be only unrate without outcomes
            let rankIconBefore = result.amountGames >= 10 ? emojis[`rank_${Util.tsToRankIcon(result.prevMu, result.prevSigma, rankCap)}`] : emojis.unranked;
            let rankIconAfter = amountAfter >= 10 ? emojis[`rank_${Util.tsToRankIcon(result.newMu, result.newSigma, rankCap)}`] : emojis.unranked;

            const ratingChange = Math.abs(result.prevMu - result.newMu);

            playerNicks.push(`${result.prevMu > result.newMu ? emojis.decrease : emojis.increase}${DjsUtil.escapeMarkdown(p.nick.split('`').join(''))}`);;

            from.push(`${rankIconBefore}${result.prevMu ? Util.tsToEloNumber(result.prevMu) : 'UNRATED'}`);
            to.push(`${rankIconAfter}${result.newMu ? Util.tsToEloNumber(result.newMu) : 'UNRATED'} ${result.newMu ? `(**${result.prevMu > result.newMu ? '-' : '+'}${Util.tsToEloNumber(ratingChange)}**)` : ''}`);
        });

        let fieldData: Discord.EmbedFieldData[];
        let title;

        if (outcomes) {
            const mappedOutcomes = outcomes.map(o => {
                const team = pickup.teams.find(t => t.name === o.team).alias || o.team;
                return `**${team}** - **${o.result.toUpperCase()}**`;
            });

            fieldData = [
                { name: 'Results', value: mappedOutcomes.join(' / ') },
                { name: 'Player', value: playerNicks.join('\n'), inline: true },
                { name: 'From', value: from.join('\n'), inline: true },
                { name: 'To', value: to.join('\n'), inline: true }
            ]

            title = `${pickup.isRated ? 'Rerated' : 'Rated'} pickup #${pickup.pickupId} - ${pickup.name}`;
        } else {
            fieldData = [
                { name: 'Player', value: playerNicks.join('\n'), inline: true },
                { name: 'From', value: from.join('\n'), inline: true },
                { name: 'To', value: to.join('\n'), inline: true }
            ]

            title = `Unrated pickup #${pickup.pickupId} - ${pickup.name}`;
        }

        const ratingUpdateCard = new Discord.MessageEmbed()
            .setColor('#126e82')
            .setTitle(title)
            .addFields(fieldData)

        return ratingUpdateCard;
    }
}