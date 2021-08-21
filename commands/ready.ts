import { Command } from '../core/types';
import GuildModel from '../models/guild';
import PlayerModel from '../models/player';
import afkCheckStage from '../core/stages/afkCheck';
import Util from '../core/util';
import { GuildMember } from 'discord.js';

const command: Command = {
    cmd: 'ready',
    applicationCommand: {
        global: true
    },
    category: 'pickup',
    aliases: ['r'],
    shortDesc: 'Ready up for a pickup when you are marked as AFK',
    desc: 'Ready up for a pickup when you are marked as AFK',
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        const playerState = await PlayerModel.getPlayerState(BigInt(guild.id), BigInt(member.id));

        if (!playerState || !playerState.isAfk) {
            return Util.send(message ? message : interaction, 'error', 'you are not set as AFK player');
        }

        let pendingPickupsMap = await GuildModel.getPendingPickups(BigInt(guild.id));

        if (!pendingPickupsMap || !pendingPickupsMap.has(guild.id)) {
            return Util.send(message ? message : interaction, 'error', 'there is no pending pickup to ready up for');
        }

        const pendingPickups = pendingPickupsMap.get(guild.id)
            .filter(pendingPickup => pendingPickup.stage === 'afk_check');

        if (!pendingPickups.length) {
            return Util.send(message ? message : interaction, 'error', 'there is no pending pickup to ready up for');
        }

        const playerAddedTo = pendingPickups.filter(pendingPickup => {
            const players = pendingPickup.players.map(player => player.id);
            return players.includes(member.id);
        });

        if (!playerAddedTo.length) {
            return Util.send(message ? message : interaction, 'error', 'you are not added to any pending pickup');
        }
        const readiedUpPickups = [];
        for (const pendingPickup of playerAddedTo) {
            const addedPlayers = pendingPickup.players.map(player => player.id);

            // Check if there is more than one afk player
            const afkPlayers = await GuildModel.getAfks(BigInt(guild.id), ...addedPlayers);

            // The player calling the ready command is the last player being afk, trigger the check stage
            if (afkPlayers.length < 2) {
                if (interaction) {
                    await Util.send(interaction, 'success', 'readied up, all players ready');
                }
                return await afkCheckStage(guild, pendingPickup.pickupConfigId);
            }

            readiedUpPickups.push(pendingPickup.name);
        }

        await GuildModel.removeAfks(null, BigInt(guild.id), member.id);

        await Util.send(message ? message : interaction, 'success', `readied up for ${readiedUpPickups.map(name => `**${name}**`).join(', ')}`);
    }
}

module.exports = command;