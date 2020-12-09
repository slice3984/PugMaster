import Discord from 'discord.js';
import { rate, Rating } from 'ts-trueskill';
import PickupModel from "../models/pickup";
import PickupState from './pickupState';
import Util from './util';
import GuildModel from '../models/guild';
import StatsModel from '../models/stats';
import EloModel from '../models/elo';
import afkCheckStage from './stages/afkCheck';
import { manualPicking } from './stages/manualPicking';
import { randomTeams } from './stages/randomTeams';
import { PickupSettings, RateablePickup } from './types';
import Bot from './bot';
import Logger from './logger';

export default class PickupStage {
    private constructor() { }

    static async handle(guild: Discord.Guild, pickupConfigId: number) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);
        const pickupChannel = await Util.getPickupChannel(guild);

        // Afk check
        if (pickupSettings.afkCheck) {
            await PickupModel.setPending(BigInt(guild.id), pickupConfigId, 'afk_check');

            try {
                return await afkCheckStage(guild, pickupConfigId, true);
            } catch (err) {
                Logger.logError('AFK check failed in PickupStage', err, false, guild.id, guild.name);

                const pickup = await PickupModel.getActivePickup(BigInt(guild.id), pickupConfigId);
                const players = pickup.players.map(player => player.id);

                await GuildModel.removeAfks(null, BigInt(guild.id), ...players);

                if (pickupChannel) {
                    pickupChannel.send(`afk check failed, attempting to progress to the next stage for **pickup ${pickup.name}** without checking`);
                }
            }
        }

        this.handleStart(guild, pickupSettings, pickupChannel);
    }

    static async handleStart(guild: Discord.Guild, pickupSettings: PickupSettings, pickupChannel: Discord.TextChannel) {
        switch (pickupSettings.pickMode) {
            case 'no_teams':
                try {
                    await this.startPickup(guild, pickupSettings.id);
                } catch (err) {
                    Logger.logError('pickup start failed in PickupStage', err, false, guild.id, guild.name);
                    await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                    if (pickupChannel) {
                        pickupChannel.send(`something went wrong starting the pickup, **pickup ${pickupSettings.name}** cleared`);
                    }
                }
                break;
            case 'manual':
                try {
                    await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'picking_manual');
                    await manualPicking(guild, pickupSettings.id, true);
                } catch (err) {
                    Logger.logError('manual picking failed in PickupStage', err, false, guild.id, guild.name);

                    // Still attempt to start without teams
                    try {
                        Bot.getInstance().getGuild(guild.id).pendingPickups.delete(pickupSettings.id);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in picking phase, attempting to start without teams`);
                        }

                        await PickupModel.clearTeams(BigInt(guild.id), pickupSettings.id);
                        await this.startPickup(guild, pickupSettings.id);
                    } catch (err) {
                        Logger.logError('start attempt after failed picking failed in PickupStage', err, false, guild.id, guild.name);
                        await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                        }
                    }
                }
                break;
            case 'random':
                try {
                    await randomTeams(guild, pickupSettings.id);
                } catch (err) {
                    Logger.logError('random team picking failed in PickupStage', err, false, guild.id, guild.name);
                    try {
                        // Start without teams
                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in random team generation, attempting to start without teams`);
                        }

                        await this.startPickup(guild, pickupSettings.id);
                    } catch (err) {
                        Logger.logError('start attempt after failed random generation failed in PickupStage', err, false, guild.id, guild.name);

                        await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                        }
                    }
                }
                break;
            case 'elo':
            // TODO: Generate teams and call startPickup with generated teams
        }
    }

    static async startPickup(guild: Discord.Guild, pickupConfigId: number, teams?: bigint[][], captains?: bigint[]) {
        const aboutToStart = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id), false)).values())
            .find(pickup => pickup.configId === pickupConfigId);

        const addedPlayers = aboutToStart.players.map(player => player.id);

        let players;

        if (teams) {
            players = teams;
        } else {
            players = addedPlayers;
        }

        // Remove players
        await PickupState.removePlayers(guild.id, true, pickupConfigId, ...addedPlayers);

        // Get & parse start message and display that
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), +aboutToStart.configId);
        const guildSettings = await GuildModel.getGuildSettings(guild);

        const startMessage = await Util.parseStartMessage(BigInt(guild.id), guildSettings.startMessage, pickupSettings, players);

        if (startMessage.length) {
            const pickupChannel = await Util.getPickupChannel(guild);

            if (pickupChannel) {
                await pickupChannel.send(startMessage);
            }

            await PickupState.showPickupStatus(guild);
        }

        // DM players with enabled notifications
        const playersToDm = await GuildModel.getPlayersWithNotify(BigInt(guild.id), ...addedPlayers);

        if (playersToDm.length) {
            const dmMessage = await Util.parseNotifySubMessage(BigInt(guild.id), guildSettings.notifyMessage, pickupSettings);

            if (dmMessage.length) {
                for (const playerId of playersToDm) {
                    const member = guild.members.cache.get(playerId);
                    if (member) {
                        await member.send(dmMessage);
                    }
                }
            }
        }

        try {
            await StatsModel.storePickup(BigInt(guild.id), pickupConfigId, players, captains);
        } catch (err) {
            Logger.logError('storing a pickup failed', err, false, guild.id, guild.name);
            const pickupChannel = await Util.getPickupChannel(guild);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong storing the **${aboutToStart.name}** pickup, pickup not stored`);
            }
        }
    }

    static async rateMatch(usePrevRatings: boolean, guildId: string, pickupToRate: RateablePickup) {
        const playerIds = pickupToRate.teams.flatMap(p => p.players.map(p2 => p2.id));

        let storedRatings;

        if (usePrevRatings) {
            storedRatings = await EloModel.getEloRatings(BigInt(guildId), true, ...playerIds.map(id => BigInt(id)));
        } else {
            storedRatings = await EloModel.getEloRatings(BigInt(guildId), false, ...playerIds.map(id => BigInt(id)));
        }

        const newRatings: { playerId: string; rating: Rating }[][] = [];

        // Get trueskill ratings for every player
        pickupToRate.teams.forEach(team => {
            const teamRatings: { playerId: string; rating: Rating }[] = [];

            team.players.forEach(player => {
                const previousRating = storedRatings.find(rating => rating.playerId === player.id);

                // No previous rating, create a new one
                if (!previousRating) {
                    const rating = new Rating();
                    teamRatings.push({
                        playerId: player.id,
                        rating
                    });
                } else {
                    teamRatings.push({
                        playerId: player.id,
                        rating: new Rating(previousRating.mu, previousRating.sigma)
                    });
                }
            });

            newRatings.push(teamRatings);
        });

        // Calculate new ratings
        const ratingArr = newRatings.map(t => t.map(p => p.rating));
        const computedValues = rate(ratingArr, pickupToRate.teams.map(t => {
            switch (t.outcome) {
                case 'win':
                    return -1;
                case 'draw':
                    return 0;
                case 'loss':
                    return 1;
            }
        }));

        const outcomes = pickupToRate.teams.map(t => {
            return {
                team: t.name,
                result: t.outcome
            }
        });

        const ratingUpdates: { id: bigint; mu: number; sigma: number }[] = [];

        computedValues.flat(10).forEach((rating, index) => {
            ratingUpdates.push({
                id: BigInt(playerIds[index]),
                mu: rating.mu,
                sigma: rating.sigma
            });
        });

        await EloModel.ratePickup(BigInt(guildId), pickupToRate.pickupId, usePrevRatings, outcomes, ...ratingUpdates);
    }

    static async unrateMatch(guildId: string, pickupToUnrate: RateablePickup) {
        const playerIds = pickupToUnrate.teams.flatMap(p => p.players.map(p2 => BigInt(p2.id)));
        await EloModel.unratePickup(BigInt(guildId), pickupToUnrate.pickupId, ...playerIds);
    }
}