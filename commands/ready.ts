import { Command } from '../core/types';
import GuildModel from '../models/guild';
import PlayerModel from '../models/player';
import { GuildMember } from 'discord.js';
import PickupStage from '../core/PickupStage';

const command: Command = {
    cmd: 'ready',
    category: 'pickup',
    aliases: ['r'],
    shortDesc: 'Ready up for a pickup when you are marked as AFK',
    desc: 'Ready up for a pickup when you are marked as AFK',
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        let isPlayerAfk = await (await PlayerModel.getPlayerState(BigInt(message.guild.id), BigInt(message.author.id))).isAfk;

        if (!isPlayerAfk) {
            return message.reply('you are not set as AFK player');
        }

        let pendingPickupsMap = await GuildModel.getPendingPickups(BigInt(message.guild.id));

        if (!pendingPickupsMap.has(BigInt(message.guild.id))) {
            return message.reply('there is no pending pickup to ready up for');
        }

        const pendingPickups = pendingPickupsMap.get(BigInt(message.guild.id))
            .filter(pendingPickup => pendingPickup.stage === 'afk_check');

        if (!pendingPickups.length) {
            return message.reply('there is no pending pickup to ready up for');
        }

        const playerAddedTo = pendingPickups.filter(pendingPickup => {
            const players = pendingPickup.teams[0].players.map(player => player.id);
            return players.includes(BigInt(message.author.id));
        });

        if (!playerAddedTo.length) {
            return message.reply('you are not added to any pending pickup');
        }
        const readiedUpPickups = [];
        for (const pendingPickup of playerAddedTo) {
            const amountAdded = pendingPickup.amountPlayersAdded;
            const capacity = pendingPickup.maxPlayers;

            if (amountAdded === capacity) {
                await PickupStage.afkCheckStage(message.guild, pendingPickup.pickupConfigId);
                return;
            } else {
                readiedUpPickups.push(pendingPickup.name);
            }
        }

        await GuildModel.removeAfks(BigInt(message.guild.id), message.author.id);
        message.channel.send(`${message.author} readied up for ${readiedUpPickups.map(name => `**${name}**`).join(', ')}`);
    }
}

module.exports = command;