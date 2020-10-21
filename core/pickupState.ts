import Discord from 'discord.js';
import Bot from './bot';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import PlayerModel from '../models/player';
import Util from '../core/util';
import { abortPickingStagePickup } from './stages/manualPicking'
import PickupStage from './PickupStage';
import Logger from './logger';

export default class PickupState {
    private constructor() { }

    static async addPlayer(member: Discord.GuildMember, ...pickupIds: number[]) {
        const activePickups = await PickupModel.getActivePickups(BigInt(member.guild.id));
        const pickupChannel = await Util.getPickupChannel(member.guild);

        // No active pickups
        if (!activePickups.size) {
            // No need to check if the pickup started
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
        } else {
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);

            // Pickup start check
            // First pickup about to start
            // Loop in order of the given pickups
            for (const id of pickupIds) {
                let pickup = Array.from(activePickups.values()).find(pickup => pickup.configId === id);

                if (!pickup) {
                    continue;
                }

                // Pickup is about to start
                if (pickup.maxPlayers === pickup.players.length + 1) {
                    try {
                        await PickupStage.handle(member.guild, +pickup.configId);
                    } catch (err) {
                        Logger.logError('handling the pickup failed in PickupState', err, false, member.guild.id, member.guild.name);
                        await PickupModel.resetPickup(BigInt(member.guild.id), pickup.configId);

                        if (pickupChannel) {
                            pickupChannel.send(`something went wrong handling the pickup, **${pickup.name}** cleared`);
                        }
                    }

                    return;
                }
            }
        }

        const genPickupInfo = (pickup, modified) => {
            let name;
            let added;
            let required;

            if (modified) {
                name = `**${pickup.name}**`;
                added = `**${pickup.players.length}**`;
                required = `**${pickup.maxPlayers}**`;
            } else {
                name = pickup.name;
                added = pickup.players.length;
                required = pickup.maxPlayers;
            }

            return `${name} [ ${added} / ${required}${modified ? ' ᐃ' : ''} ]`;
        };

        const pickups = Array.from((await PickupModel.getActivePickups(BigInt(member.guild.id))).values())
            .sort((a, b) => b.players.length - a.players.length);

        let msg = '';

        pickups.forEach(pickup => {
            if (pickupIds.includes(pickup.configId)) {
                msg += `${genPickupInfo(pickup, true)} `;
            } else {
                msg += `${genPickupInfo(pickup, false)} `;
            }
        });

        if (pickupChannel) {
            pickupChannel.send(msg);
        }

        return;
    }

    // pickupConfigId => Required to make sure the started pickup gets ignored if it was in pending state
    static async handlePendingAfkPickups(guildId: string, pickupConfigId: number | null, playerIds: string[] | null, ...pickupIds) {
        let pickupsToCancel = [];

        if (pickupIds.length === 1) {
            let pending = await GuildModel.getPendingPickup(BigInt(guildId), pickupIds[0]);
            if (!pending || pending.stage === 'picking_manual' || pending.pickupConfigId === pickupConfigId) {
                return;
            }

            pickupsToCancel.push({
                name: pending.name,
                id: pending.pickupConfigId,
                playerIds: pending.teams[0].players.map(player => player.id)
            })
        } else if (pickupIds.length > 1) {
            let pendingMap = await GuildModel.getPendingPickups(BigInt(guildId));

            if (!pendingMap) {
                return;
            }

            let pending = pendingMap.get(guildId)
                .filter(pickup => pickupIds.includes(pickup.pickupConfigId)
                    && pickup.stage === 'afk_check'
                    && pickup.pickupConfigId !== pickupConfigId);

            if (!pending.length) {
                return;
            }

            pending.forEach(pickup => pickupsToCancel.push({
                name: pickup.name,
                id: pickup.pickupConfigId,
                playerIds: pickup.teams[0].players.map(player => player.id)
            }));
        }


        if (playerIds && !pickupIds.length) {
            const pendingMap = await GuildModel.getPendingPickups(BigInt(guildId));
            if (!pendingMap) {
                return;
            }

            let pending = pendingMap.get(guildId)
                .filter(pickup => {
                    if (pickup.stage === 'picking_manual') {
                        return false;
                    }

                    if (pickup.pickupConfigId === pickupConfigId) {
                        return false;
                    }

                    const players = pickup.teams[0].players.map(player => player.id);
                    return players.some(id => playerIds.includes(id));
                });

            if (!pending.length) {
                return;
            }

            pending.forEach(pickup => pickupsToCancel.push({
                name: pickup.name,
                id: pickup.pickupConfigId,
                playerIds: pickup.teams[0].players.map(player => player.id)
            }));
        }

        // Remove possible afks
        let addedPlayerIds = [];
        pickupsToCancel.forEach(pickup => {
            addedPlayerIds = addedPlayerIds.concat(pickup.playerIds.filter(id => addedPlayerIds.indexOf(id) < 0));
        });

        pickupsToCancel = pickupsToCancel.filter((pickup, index) => pickupsToCancel.indexOf(pickupsToCancel.find(pu => pu.id === pickup.id)) === index);

        // Remove timeouts / Reset state
        await PickupModel.clearPendingAfkPickupStates(BigInt(guildId), addedPlayerIds, pickupsToCancel.map(pickup => pickup.id))
        const pendingPickups = Bot.getInstance().getGuild(guildId).pendingPickups;

        if (pendingPickups.size) {
            pickupsToCancel.forEach(pickup => {
                if (pendingPickups.has(pickup.id)) {
                    clearTimeout(pendingPickups.get(pickup.id));
                    pendingPickups.delete(pickup.id);
                }
            });
        }

        const guild = Bot.getInstance().getClient().guilds.cache.get(guildId.toString());
        if (guild) {
            const pickupChannel = await Util.getPickupChannel(guild);
            if (pickupChannel) {
                pickupChannel.send(`${pickupsToCancel.map(pickup => `**${pickup.name}**`).join(', ')} aborted because players are missing.`);
            }
        }
    }



    static async removePlayer(guildId: string, playerId: string, showStatus = true, ...pickupIds: number[]) {
        const bigIntGuildId = BigInt(guildId);
        const bigIntPlayerId = BigInt(playerId);

        const isInPickingStage = await PickupModel.isPlayerAddedToPendingPickup(BigInt(guildId), BigInt(playerId), 'picking_manual');

        // Only possible on server leaves or admin actions
        if (isInPickingStage) {
            await abortPickingStagePickup(guildId, playerId);
        }

        // TODO: Check if the pickup is pending and abort
        let isAddedToAnyPickup;
        if (pickupIds.length === 0) {
            isAddedToAnyPickup = await PickupModel.isPlayerAdded(bigIntGuildId, bigIntPlayerId);
            if (isAddedToAnyPickup.length === 0) {
                return;
            }

            await PlayerModel.removeExpires(bigIntGuildId, playerId);
            await PickupState.handlePendingAfkPickups(guildId, null, [playerId]);
            await PickupModel.removePlayer(null, bigIntGuildId, bigIntPlayerId);
        } else {
            await PickupState.handlePendingAfkPickups(guildId, null, null, ...pickupIds);
            await PickupModel.removePlayer(null, bigIntGuildId, bigIntPlayerId, ...pickupIds);
        }

        const playerAddedTo = await PickupModel.isPlayerAdded(bigIntGuildId, bigIntPlayerId);

        if (!playerAddedTo.length) {
            await PlayerModel.resetPlayerState(bigIntGuildId, bigIntPlayerId);
        }

        if (showStatus) {
            const guild = Bot.getInstance().getClient().guilds.cache.get(guildId.toString());
            const pickupChannel = await Util.getPickupChannel(guild);
            const pickups = Array.from((await PickupModel.getActivePickups(bigIntGuildId)).values())
                .sort((a, b) => b.players.length - a.players.length);

            const genPickupInfo = (pickup, modified) => {
                let name;
                let added;
                let required;

                if (modified) {
                    name = `**${pickup.name}**`;
                    added = `**${pickup.players.length}**`;
                    required = `**${pickup.maxPlayers}**`;
                } else {
                    name = pickup.name;
                    added = pickup.players.length;
                    required = pickup.maxPlayers;
                }

                return `${name} [ ${added} / ${required}${modified ? ' ᐁ' : ''} ]`;
            };

            if (pickupChannel) {
                let msg = '';
                let ids;

                if (pickupIds.length === 0) {
                    ids = isAddedToAnyPickup;
                } else {
                    ids = pickupIds;
                }

                pickups.forEach(pickup => {
                    if (ids.includes(pickup.configId)) {
                        msg += `${genPickupInfo(pickup, true)} `;
                    } else {
                        msg += `${genPickupInfo(pickup, false)} `;
                    }
                });

                if (!msg.length) {
                    return pickupChannel.send('No active pickups');
                }

                if (pickupChannel) {
                    pickupChannel.send(msg)
                }

                return;
            }
        }
    }

    // Used for the bot on auto removes (ao expire / player expire...)
    static async removePlayers(guildId: string, pendingCheck = true, pickupConfigId, ...playerIds) {
        if (pendingCheck) {
            await PickupState.handlePendingAfkPickups(guildId, pickupConfigId, playerIds);
        }
        await PickupModel.removePlayers(BigInt(guildId), ...playerIds);
        await GuildModel.resetPlayerStates(BigInt(guildId), ...playerIds);
    }

    // Used for manual picking removes
    static async removePlayersExclude(guildId: string, toExclude: number[], playerIds: string[]) {
        await PickupState.handlePendingAfkPickups(guildId, null, playerIds);
        await PickupModel.removePlayersExclude(BigInt(guildId), toExclude, ...playerIds.map(id => BigInt(id)));
        await GuildModel.resetPlayerStates(BigInt(guildId), ...playerIds.map(id => BigInt(id)));
    }

    static async showPickupStatus(guild: Discord.Guild) {
        const pickupChannel = await Util.getPickupChannel(guild);

        if (!pickupChannel) {
            return;
        }
        const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]`;

        const pickups = Array.from((await PickupModel.getActivePickups(BigInt(guild.id))).values())
            .sort((a, b) => b.players.length - a.players.length);

        let msg = '';
        pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);
        pickupChannel.send(msg || 'No active pickups');
    }
}