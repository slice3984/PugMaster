import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import PickupState from './pickupState';
import Util from './util';
import GuildModel from '../models/guild';
import StatsModel from '../models/stats';
import afkCheckStage from './stages/afkCheck';
import { manualPicking } from './stages/manualPicking';
import { randomTeams } from './stages/randomTeams';
import { PickupSettings, PickupStartConfiguration, PickupStageType } from './types';
import Logger from './logger';
import { ratedTeams } from './stages/ratedTeams';
import { autopick } from './stages/autopick';
import MappoolModel from '../models/mappool';
import { mapVote } from './stages/mapVote';
import Bot from './bot';

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
                this.startCallback(false, 'no_teams', pickupSettings, { guild, pickupConfigId: pickupSettings.id });
                break;
            case 'manual':
                await PickupModel.setPending(BigInt(guild.id), pickupSettings.id, 'picking_manual');
                try {
                    await manualPicking(guild, pickupSettings.id, true, this.startCallback);
                } catch (_) {
                    await this.startCallback(true, 'manual', pickupSettings, { guild, pickupConfigId: pickupSettings.id });
                }
                break;
            case 'random':
                try {
                    await randomTeams(guild, pickupSettings, this.startCallback);
                } catch (_) {
                    await this.startCallback(true, 'random', pickupSettings, { guild, pickupConfigId: pickupSettings.id });
                }
                break;
            case 'elo':
                try {
                    await ratedTeams(guild, pickupSettings, this.startCallback);
                } catch (_) {
                    await this.startCallback(true, 'elo', pickupSettings, { guild, pickupConfigId: pickupSettings.id });
                }
                break;
            case 'autopick':
                try {
                    await autopick(guild, pickupSettings, this.startCallback);
                } catch (err) {
                    await this.startCallback(true, 'autopick', pickupSettings, { guild, pickupConfigId: pickupSettings.id });
                }
        }
    }

    static async startCallback(error: boolean, stage: PickupStageType, pickupSettings: PickupSettings, config: PickupStartConfiguration) {
        const pickupChannel = await Util.getPickupChannel(config.guild);

        const aboutToStart = Array.from(await (await PickupModel.getActivePickups(BigInt(config.guild.id), false)).values())
            .find(pickup => pickup.configId === config.pickupConfigId);

        if (error) {
            let errorStr = '';

            try {
                switch (stage) {
                    case 'manual':
                    case 'autopick':
                        const guildSettings = Bot.getInstance().getGuild(config.guild.id);
                        const pendingPickup = guildSettings.pendingPickingPickups.get(config.pickupConfigId);

                        if (pendingPickup) {
                            pendingPickup.messageCollector.stop();
                            pendingPickup.selectMenuCollector.stop();
                            guildSettings.pendingPickingPickups.delete(config.pickupConfigId);
                        }
                        errorStr = stage === 'manual' ? 'manual team picking' : 'autopick mode';
                        break;
                    case 'random':
                        errorStr = 'random team generation';
                        break;
                    case 'elo':
                        errorStr = 'rating based team generation';
                        break;
                }

                Logger.logError(`error occured in ${stage} for pickup ${pickupSettings.name}`, null, false, config.guild.id, config.guild.name);

                if (pickupChannel) {
                    pickupChannel.send(`something went wrong starting pickup **${pickupSettings.name}** in ${errorStr} stage, attempting to start without teams`);
                }
            } catch (err) {
                await PickupModel.resetPickup(BigInt(config.guild.id), pickupSettings.id);

                if (pickupChannel) {
                    pickupChannel.send(`failed to start pickup **${pickupSettings.name}**, pickup cleared`);
                }

                Logger.logError(`exception occured in error handling at stage ${stage} for pickup ${pickupSettings.name}`, err, false, config.guild.id, config.guild.name);
                return;
            }
        }
        try {
            if (pickupSettings.mapvote) {
                if (!config.teams) {
                    const addedPlayers = aboutToStart.players.map(player => BigInt(player.id));
                    config.teams = addedPlayers;
                }

                const result = await mapVote(config.guild, config, pickupSettings);

                // Aborted, server leave or admin action 
                if (result.error && result.error === 'aborted') {
                    return;
                }

                if (!result.error) {
                    config.map = result.map;
                }
            } else {
                // Random map if pool set
                if (pickupSettings.mapPoolId) {
                    const poolName = await MappoolModel.getPoolName(BigInt(config.guild.id), pickupSettings.mapPoolId);
                    const maps = await MappoolModel.getMaps(BigInt(config.guild.id), poolName);
                    config.map = maps[Math.floor(Math.random() * maps.length)];
                }
            }
            await PickupStage.startPickup(config, aboutToStart);

            // Update add application command
            const bot = Bot.getInstance();
            await bot.updatePickupDependentApplicationCommands(config.guild);

        } catch (err) {
            await PickupModel.resetPickup(BigInt(config.guild.id), pickupSettings.id);
            Logger.logError(`exception occured in error handling at stage ${stage} for pickup ${pickupSettings.name}`, err, false, config.guild.id, config.guild.name);

            if (pickupChannel) {
                pickupChannel.send(`failed to start pickup **${pickupSettings.name}**, pickup cleared`);
            }
        }
    }

    static async startPickup(config: PickupStartConfiguration, pickup) {


        const addedPlayers = pickup.players.map(player => player.id);

        if (!config.teams) {
            config.teams = addedPlayers.map(p => BigInt(p));
        }

        // Remove players
        await PickupState.removePlayers(config.guild.id, true, config.pickupConfigId, ...addedPlayers);

        // Get & parse start message and display that
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(config.guild.id), +pickup.configId);
        const guildSettings = await GuildModel.getGuildSettings(config.guild);

        const startMessage = await Util.parseStartMessage(guildSettings.startMessage, pickupSettings, config);

        if (startMessage.length) {
            const pickupChannel = await Util.getPickupChannel(config.guild);

            if (pickupChannel) {
                await pickupChannel.send(startMessage);
            }

            await PickupState.showPickupStatus(config.guild);
        }

        // DM players with enabled notifications
        const playersToDm = await GuildModel.getPlayersWithNotify(BigInt(config.guild.id), ...addedPlayers);

        if (playersToDm.length) {
            const dmMessage = await Util.parseNotifySubMessage(BigInt(config.guild.id), guildSettings.notifyMessage, pickupSettings);

            if (dmMessage.length) {
                for (const playerId of playersToDm) {
                    const member = config.guild.members.cache.get(playerId as Discord.Snowflake);
                    if (member) {
                        try {
                            // In case the player blocked the bot
                            await member.send(dmMessage);
                        } catch (_err) { }
                    }
                }
            }
        }

        try {
            await StatsModel.storePickup(config);
        } catch (err) {
            Logger.logError('storing a pickup failed', err, false, config.guild.id, config.guild.name);
            const pickupChannel = await Util.getPickupChannel(config.guild);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong storing the **${pickup.name}** pickup, pickup not stored`);
            }
        }
    }
}