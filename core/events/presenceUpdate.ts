import Discord from 'discord.js';
import Bot from "../bot";
import PickupModel from '../../models/pickup';
import PlayerModel from '../../models/player';
import PickupState from '../pickupState';
import GuildModel from '../../models/guild';
import Util from '../util';

module.exports = async (bot: Bot, oldPresence: Discord.Presence, newPresence: Discord.Presence) => {
    if (newPresence.status === 'offline') {
        const isAdded = await PickupModel.isPlayerAdded(BigInt(newPresence.guild.id), BigInt(newPresence.member.id));
        if (isAdded.length > 0) {
            // Only remove if no ao is active
            const gotAo = await PlayerModel.getAos(BigInt(newPresence.guild.id), newPresence.member.id);

            if (gotAo) {
                return;
            }
            const pickupChannel = await Util.getPickupChannel(newPresence.guild);
            pickupChannel.send(`${newPresence.member.displayName} went offline and got removed from all pickups`);
            await PickupState.removePlayer(newPresence.guild.id, newPresence.member.id);
        }
    }
}