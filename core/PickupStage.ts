import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import PickupState from './pickupState';
import Util from './util';
import GuildModel from '../models/guild';
import StatsModel from '../models/stats';
import afkCheckStage from './stages/afkCheck';
import { manualPicking } from './stages/manualPicking';
import { randomTeams } from './stages/randomTeams';
import { PickupSettings, PickupStartConfiguration } from './types';
import Bot from './bot';
import Logger from './logger';
import { ratedTeams } from './stages/ratedTeams';
import { autopick } from './stages/autopick';

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
                    await this.startPickup({ guild, pickupConfigId: pickupSettings.id });
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
                        await this.startPickup({ guild, pickupConfigId: pickupSettings.id });
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

                        await this.startPickup({ guild, pickupConfigId: pickupSettings.id });
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
                try {
                    await ratedTeams(guild, pickupSettings.id);
                } catch (err) {
                    Logger.logError('rated team picking failed in PickupStage', err, false, guild.id, guild.name);
                    try {
                        // Start without teams
                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in rating based team generation, attempting to start without teams`);
                        }

                        await this.startPickup({ guild, pickupConfigId: pickupSettings.id });
                    } catch (err) {
                        Logger.logError('start attempt after failed rating based team generation failed in PickupStage', err, false, guild.id, guild.name);

                        await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                        }
                    }
                }
                break;
            case 'autopick':
                try {
                    await autopick(guild, pickupSettings.id);
                } catch (err) {
                    Logger.logError('auto pick failed in PickupStage', err, false, guild.id, guild.name);
                    try {
                        // Start without teams
                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong with **pickup ${pickupSettings.name}** in auto pick mode, attempting to start without teams`);
                        }

                        await this.startPickup({ guild, pickupConfigId: pickupSettings.id });
                    } catch (err) {
                        Logger.logError('start attempt after failed auto pick mode failed in PickupStage', err, false, guild.id, guild.name);

                        await PickupModel.resetPickup(BigInt(guild.id), pickupSettings.id);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong starting **pickup ${pickupSettings.name}** without teams, pickup cleared`);
                        }
                    }
                }
        }
    }

    static async startPickup(config: PickupStartConfiguration) {
        const aboutToStart = Array.from(await (await PickupModel.getActivePickups(BigInt(config.guild.id), false)).values())
            .find(pickup => pickup.configId === config.pickupConfigId);

        const addedPlayers = aboutToStart.players.map(player => player.id);

        if (!config.teams) {
            config.teams = addedPlayers.map(p => BigInt(p));
        }

        // Remove players
        await PickupState.removePlayers(config.guild.id, true, config.pickupConfigId, ...addedPlayers);

        // Get & parse start message and display that
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(config.guild.id), +aboutToStart.configId);
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
                    const member = config.guild.members.cache.get(playerId);
                    if (member) {
                        await member.send(dmMessage);
                    }
                }
            }
        }

        try {
            await StatsModel.storePickup(BigInt(config.guild.id), config.pickupConfigId, config.teams, config.captains);
        } catch (err) {
            Logger.logError('storing a pickup failed', err, false, config.guild.id, config.guild.name);
            const pickupChannel = await Util.getPickupChannel(config.guild);

            if (pickupChannel) {
                pickupChannel.send(`something went wrong storing the **${aboutToStart.name}** pickup, pickup not stored`);
            }
        }
    }
}