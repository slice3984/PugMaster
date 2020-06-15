import Discord from 'discord.js';
import Bot from '../bot';
import PickupModel from '../../models/pickup';
import PickupState from '../pickupState';
import Util from '../util';

module.exports = async (bot: Bot, member: Discord.GuildMember) => {
    const isAdded = await PickupModel.isPlayerAdded(BigInt(member.guild.id), BigInt(member.id));
    if (isAdded.length > 0) {
        await PickupModel.removePlayer(BigInt(member.guild.id), BigInt(member.id));
        const pickupChannel = await Util.getPickupChannel(member.guild);
        pickupChannel.send(`${member.displayName} got removed from all pickups since he left the server`);
        PickupState.showPickupStatus(member.guild);
    }
}