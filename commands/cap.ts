import Bot from '../core/bot';
import { Command } from '../core/types';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'cap',
    category: 'pickup',
    shortDesc: 'Become a captain of a pickup, call again to uncap',
    desc: 'Become a captain of a pickup, call again to uncap',
    global: false,
    perms: false,
    exec: async (bot, message, params) => {
        const guildSettings = Bot.getInstance().getGuild(message.guild.id);

        const addedToCapSelectionPickup = await PickupModel.isPlayerAddedToPendingPickup(BigInt(message.guild.id), BigInt(message.member.id), 'captain_selection');

        if (!addedToCapSelectionPickup) {
            return message.reply('you are not added to any pickup in captain selection stage');
        }

        const pendingPickups = await GuildModel.getPendingPickups(BigInt(message.guild.id));

        if (pendingPickups) {
            const pendingPickup = pendingPickups.get(message.guild.id)
                .find(pending => {
                    return pending.stage === 'captain_selection'
                        && (pending.teams.find(team => team.players
                            .map(p => p.id)
                            .includes(message.member.id))
                            || pending.playersLeft.map(p => p.id).includes(message.member.id)
                        )
                });

            if (!pendingPickup) {
                return;
            }

            const updateCb = guildSettings.captainSelectionUpdateCbs.get(pendingPickup.pickupConfigId);

            if (!updateCb) {
                return;
            }

            const msg = updateCb(message.author.id, false);

            if (msg) {
                message.channel.send(msg);
            }

            return;
        }
    }
}

module.exports = command;