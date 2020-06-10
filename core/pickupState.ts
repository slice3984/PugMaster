import Discord from 'discord.js';
import Bot from './bot';

const bot = Bot.getInstance();

export default class PickupState {
    private constructor() { }

    static addPlayer(user: Discord.GuildMember, pickup: string) {

    }
}