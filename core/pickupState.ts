import Discord from 'discord.js';
import Bot from './bot';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import PlayerModel from '../models/player';
import Util from '../core/util';
import { PickupSettings } from './types';
import PickupStage from './PickupStage';

export default class PickupState {
    private constructor() { }

    static async addPlayer(member: Discord.GuildMember, ...pickupIds: number[]) {
        const activePickups = await PickupModel.getActivePickups(BigInt(member.guild.id));
        const pickupChannel = await Util.getPickupChannel(member.guild);

        // No active pickups
        if (!activePickups.size) {
            // No need to check if the pickup started
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
            await PickupModel.updatePlayerAddTime(BigInt(member.guild.id), BigInt(member.id));
        } else {
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
            await PickupModel.updatePlayerAddTime(BigInt(member.guild.id), BigInt(member.id));

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
                    PickupStage.handle(member.guild, +pickup.configId);
                    return;
                }
            }
        }

        const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]`;

        const pickups = Array.from((await PickupModel.getActivePickups(BigInt(member.guild.id))).values())
            .sort((a, b) => b.players.length - a.players.length);
        let msg = '';
        if (pickupIds.length > 1) {
            pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);
        } else {
            msg = genPickupInfo(pickups.find(pickup => pickup.configId == pickupIds[0]));
        }
        return pickupChannel.send(msg);
    }

    // pickupConfigId => Required to make sure the started pickup gets ignored if it was in pending state
    static async handlePendingAfkPickups(guildId: bigint, pickupConfigId: number | null, playerIds: bigint[] | null, ...pickupIds) {
        let pickupsToCancel = [];

        if (pickupIds.length === 1) {
            let pending = await GuildModel.getPendingPickup(guildId, pickupIds[0]);
            if (!pending || pending.stage === 'picking_manual' || pending.pickupConfigId === pickupConfigId) {
                return;
            }

            pickupsToCancel.push({
                name: pending.name,
                id: pending.pickupConfigId,
                playerIds: pending.teams[0].players.map(player => player.id)
            })
        } else if (pickupIds.length > 1) {
            let pendingMap = await GuildModel.getPendingPickups(guildId);

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
            const pendingMap = await GuildModel.getPendingPickups(guildId);
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
                    return players.some(id => playerIds.map(id => BigInt(id)).includes(id));
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

        await GuildModel.removeAfks(guildId, ...addedPlayerIds);

        // Remove timeouts / Reset state
        await PickupModel.setPendings(guildId, 'fill', ...pickupsToCancel.map(pickup => pickup.id));

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

    static async removePlayer(guildId: bigint, playerId: bigint, showStatus = true, ...pickupIds: number[]) {
        // TODO: Check if the pickup is pending and abort
        if (pickupIds.length === 0) {
            const isAddedToAnyPickup = await PickupModel.isPlayerAdded(guildId, playerId);
            if (isAddedToAnyPickup.length === 0) {
                return;
            }

            await PlayerModel.removeExpires(guildId, playerId);
            await PickupState.handlePendingAfkPickups(guildId, null, [playerId]);
            await PickupModel.removePlayer(guildId, playerId);
        } else {
            await PickupState.handlePendingAfkPickups(guildId, null, null, ...pickupIds);
            await PickupModel.removePlayer(guildId, playerId, ...pickupIds);
        }

        const playerAddedTo = await PickupModel.isPlayerAdded(guildId, playerId);

        if (!playerAddedTo.length) {
            await PlayerModel.resetPlayerState(guildId, playerId);
        }

        if (showStatus) {
            const guild = Bot.getInstance().getClient().guilds.cache.get(guildId.toString());
            if (guild) {
                await PickupState.showPickupStatus(guild);
            }
        }
    }

    // Used for the bot on auto removes (ao expire / player expire...)
    static async removePlayers(guildId: bigint, pendingCheck = true, pickupConfigId, ...playerIds) {
        if (pendingCheck) {
            await PickupState.handlePendingAfkPickups(guildId, pickupConfigId, playerIds);
        }
        await PickupModel.removePlayers(guildId, ...playerIds);
        await GuildModel.resetPlayerStates(guildId, ...playerIds);
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