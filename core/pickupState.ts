import Discord from 'discord.js';
import Bot from './bot';
import PickupModel from '../models/pickup';

const bot = Bot.getInstance();

export default class PickupState {
    private constructor() { }

    static async addPlayer(member: Discord.GuildMember, ...pickupIds: number[]) {
        const activePickups = await PickupModel.getActivePickups(BigInt(member.guild.id));

        // No active pickups
        if (!activePickups.size) {
            await PickupModel.addPlayer(BigInt(member.guild.id), BigInt(member.id), ...pickupIds);

            // TODO: Show pickup status
        }
    }
}