import Discord from 'discord.js';
import PickupStage from '../core/PickupStage';
import { calculateLeftPicks, manualPicking } from '../core/stages/manualPicking';
import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'pick',
    category: 'pickup',
    aliases: ['p'],
    shortDesc: 'As captain pick a player to join your team in team picking stage',
    desc: 'As captain pick a player to join your team in team picking stage',
    args: [
        { name: '<player>..', desc: 'players to pick given as mention(s) or id(s)', required: true }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const addedToPickingPickup = await PickupModel.isPlayerAddedToPendingPickup(BigInt(message.guild.id), BigInt(message.member.id), 'picking_manual');

        if (!addedToPickingPickup) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are not added to any pickup in picking stage`));
        }

        // Player is added to a valid pickup, check if he's captain
        const pendingPickingPickups = await GuildModel.getPendingPickups(BigInt(message.guild.id));

        if (pendingPickingPickups) {
            const pendingPickup = pendingPickingPickups.get(message.guild.id)
                .find(pending => {
                    return pending.stage === 'picking_manual'
                        && (pending.teams.find(team => team.players
                            .map(p => p.id)
                            .includes(message.member.id))
                            || pending.playersLeft.map(p => p.id).includes(message.member.id)
                        )
                });

            if (!pendingPickup) {
                return;
            }

            const captains = pendingPickup.teams
                .map(team => team.players)
                .flat()
                .filter(player => player.isCaptain);

            if (!captains.map(c => c.id).includes(message.member.id)) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, you are not a captain in this pickup`));
            }

            const currentCaptain = captains.find(captain => captain.captainTurn);
            const currCaptainTeam = pendingPickup.teams.find(team => team.players.find(p => p.captainTurn)).name;

            if (currentCaptain.id !== message.member.id) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, it is not your turn, waiting for **${currentCaptain.nick}** to pick`));
            }

            // Always only one first pick
            const toPick = (pendingPickup.playersLeft.length + pendingPickup.teams.length) == pendingPickup.maxPlayers ? 1 : calculateLeftPicks(pendingPickup);

            let picks: Discord.GuildMember[] = [];

            // Removes empty args, excessive whitespaces
            params = params.filter(p => p.length);

            for (let i = 0; i < toPick; i++) {
                if (!params[i]) {
                    break;
                }

                let player = await Util.getUser(message.guild, params[i]);

                if (!player) {
                    continue;
                }

                picks.push(player as Discord.GuildMember);
            }

            if (!picks.length) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, given player${params.length > 1 ? 's' : ''} not found`));
            }

            const leftPlayersIds = pendingPickup.playersLeft.map(p => p.id);

            // Remove invalid users
            picks = picks.filter(p => leftPlayersIds.includes(p.id));

            // Remove duplicates
            picks = Util.removeObjectArrayDuplicates(picks, 'id');

            if (!picks.length) {
                return message.channel.send(Util.formatMessage('error', `${message.author}, given player${params.length > 1 ? 's are' : ' is'} not available to pick`));
            }

            await PickupModel.addTeamPlayers(BigInt(message.guild.id), pendingPickup.pickupConfigId, ...picks.map(p => {
                return {
                    id: BigInt(p.id),
                    team: currCaptainTeam,
                    isCaptain: false,
                    captainTurn: false
                }
            }));

            if (picks.length === toPick || toPick === 1) {
                // Set next captain
                let nextPickingTeam;

                // Captain of the last team
                if (currCaptainTeam.charCodeAt(0) == 'A'.charCodeAt(0) + pendingPickup.teams.length - 1) {
                    nextPickingTeam = 'A';
                } else {
                    nextPickingTeam = String.fromCharCode(currCaptainTeam.charCodeAt(0) + 1);
                }

                await PickupModel.setNewCaptainTurn(BigInt(message.guild.id), pendingPickup.pickupConfigId, nextPickingTeam);
                await PickupModel.resetPendingIteration(BigInt(message.guild.id), pendingPickup.pickupConfigId);

                // Delete the old timeout and create a new one for the next captain
                const guildSettings = bot.getGuild(message.guild.id);

                clearTimeout(guildSettings.pendingPickups.get(pendingPickup.pickupConfigId));
                guildSettings.pendingPickups.delete(pendingPickup.pickupConfigId);
                manualPicking(message.guild, pendingPickup.pickupConfigId, false, PickupStage.startCallback);
            } else {
                return message.channel.send(Util.formatMessage('success', `${message.author}, picked **${picks[0].displayName}**, please pick one more player`));
            }
        }
    }
}

module.exports = command;