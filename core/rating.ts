import * as ts from 'ts-trueskill';
import RatingModel from "../models/rating";
import { RatingPickup, RateablePickup, RatingTeam } from "./types";

interface UpdateData {
    pickups: PlayerRating[],
    playerRatings: { id: bigint, mu: number, sigma: number }[]
}

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
            return false;
        }

        const updateData = await this.generateRatings(guildId, pickupToRate, amountFollowingPickups, false);

        const outcomes = pickupToRate.teams.map(t => {
            return {
                team: t.name,
                result: t.outcome
            }
        });

        await RatingModel.rate(BigInt(guildId), pickupToRate.pickupId, pickupToRate.pickupConfigId, outcomes, updateData.pickups);
        return true;
    }

    static async unrateMatch(guildId: string, pickupToUnrate: RateablePickup): Promise<boolean> {
        // If the latest rated pickup is the one being unrated there is no need to generate new ratings
        const amountFollowingPickups = await RatingModel.getAmountOfFollowingPickups(BigInt(guildId), pickupToUnrate.pickupConfigId, pickupToUnrate.pickupId);

        if (amountFollowingPickups > Rating.RERATE_AMOUNT_LIMIT) {
            return false;
        }

        if (!amountFollowingPickups) {
            const playerRatings: { id: bigint, mu: number | null, sigma: number | null }[] = [];

            const playerIds = pickupToUnrate.teams.flatMap(p => p.players.map(p2 => BigInt(p2.id)));
            const previousKnownRatings = await RatingModel.getPreviousNewestRatings(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, ...playerIds);

            playerIds.forEach(id => {
                const prevRating = previousKnownRatings.find(rating => BigInt(rating.id) === id);
                playerRatings.push({
                    id,
                    mu: prevRating ? prevRating.mu : null,
                    sigma: prevRating ? prevRating.sigma : null
                });
            });

            await RatingModel.unrate(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, [], playerRatings);
        } else {
            const updateData = await this.generateRatings(guildId, pickupToUnrate, amountFollowingPickups, true);
            await RatingModel.unrate(BigInt(guildId), pickupToUnrate.pickupId, pickupToUnrate.pickupConfigId, updateData.pickups, updateData.playerRatings);
        }

        return true;
    }
}