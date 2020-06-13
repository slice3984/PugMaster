import Discord from 'discord.js';
import Bot from './bot';
import PickupModel from '../models/pickup';
import GuildModel from '../models/guild';
import PlayerModel from '../models/player';
import Util from '../core/util';

const bot = Bot.getInstance();

export default class PickupState {
    private constructor() { }

    static async addPlayer(member: Discord.GuildMember, ...pickupIds: number[]) {
        const activePickups = await PickupModel.getActivePickups(BigInt(member.guild.id));
        const pickupChannel = Util.getChannel(member.guild, await GuildModel.getPickupChannel(BigInt(member.guild.id))) as Discord.TextChannel;

        // No active pickups
        if (!activePickups.size) {
            // No need to check if the pickup started
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
            await PickupModel.updatePlayerAddTime(BigInt(member.guild.id), BigInt(member.id));
        } else {
            // Pickup start check
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
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

    static async removePlayer(member: Discord.GuildMember, ...pickupIds: number[]) {
        // TODO: Check if the pickup is pending and abort
        if (pickupIds.length === 0) {
            const isAddedToAnyPickup = await PickupModel.isPlayerAdded(BigInt(member.guild.id), BigInt(member.id));
            if (isAddedToAnyPickup.length === 0) {
                return;
            }

            await PickupModel.removePlayer(BigInt(member.guild.id), BigInt(member.id));
        } else {
            await PickupModel.removePlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);
        }

        const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(member.guild.id), BigInt(member.id));

        if (!playerAddedTo.length) {
            PlayerModel.removeExpires(BigInt(member.guild.id), member.id);
        }

        const pickupChannel = Util.getChannel(member.guild, await GuildModel.getPickupChannel(BigInt(member.guild.id))) as Discord.TextChannel;

        const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]`;

        const pickups = Array.from((await PickupModel.getActivePickups(BigInt(member.guild.id))).values())
            .sort((a, b) => b.players.length - a.players.length);

        let msg = '';
        pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);
        pickupChannel.send(msg || 'No active pickups');
    }
}