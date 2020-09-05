import Discord from 'discord.js';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import PickupState from '../core/pickupState';

const command: Command = {
    cmd: 'remove_player',
    category: 'admin',
    shortDesc: 'Removes a player from all pickups',
    desc: 'Removes a player from all pickups',
    args: [
        { name: '<player>', desc: 'ping', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const playerIdentifier = params[0];
        const player = await Util.getUser(message.guild, playerIdentifier, false) as Discord.GuildMember;

        if (!player) {
            return message.reply(`given player not found`);
        }

        const isAdded = await PickupModel.isPlayerAdded(BigInt(message.guild.id), BigInt(player.id));

        if (!isAdded.length) {
            return message.reply(`${player.displayName} is not added to any pickups`);
        }

        message.channel.send(`${player.displayName} got removed from all pickups`);
        await PickupState.removePlayer(BigInt(message.guild.id), BigInt(player.id));
    }
}

module.exports = command;