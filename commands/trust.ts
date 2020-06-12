import Discord from 'discord.js';
import { Command } from '../core/types';
import PlayerModel from '../models/player';
import Util from '../core/util';

const command: Command = {
    cmd: 'trust',
    shortDesc: 'Trust a player to bypass the join date restriction',
    desc: 'Trust a player to bypass the join date restriction',
    args: [
        { name: '<name>...', desc: 'ping', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const validatedUsers = [];

        for (const user of params) {
            const userObj = await Util.getUser(message.guild, user) as Discord.GuildMember;
            if (userObj) {
                validatedUsers.push(userObj);
                // Possible the player is not stored
                await PlayerModel.storeOrUpdatePlayer(BigInt(message.guild.id), BigInt(userObj.id), userObj.displayName);
            }
        }

        if (validatedUsers.length === 0) {
            return message.reply('given players not found');
        }

        // Make sure they are not trusted already
        const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(message.guild.id), validatedUsers.map(user => user.id));
        const toTrust = validatedUsers.filter(user => !alreadyTrusted.includes(user.id));

        if (toTrust.length === 0) {
            return message.reply(`the player${validatedUsers.length > 1 ? 's are' : ' is'} already trusted (${validatedUsers.map(user => user.displayName).join(', ')})`);
        }

        await PlayerModel.trustPlayers(BigInt(message.guild.id), toTrust.map(user => user.id));
        message.reply(`successfully trusted ${toTrust.map(user => user.displayName).join(', ')}`);
    }
}

module.exports = command;