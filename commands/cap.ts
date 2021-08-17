import { GuildMember } from 'discord.js';
import Bot from '../core/bot';
import { Command } from '../core/types';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'cap',
    applicationCommand: {
        global: true,
    },
    category: 'pickup',
    shortDesc: 'Become a captain of a pickup, call again to uncap',
    desc: 'Become a captain of a pickup, call again to uncap',
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        const guildSettings = Bot.getInstance().getGuild(guild.id);

        const addedToCapSelectionPickup = await PickupModel.isPlayerAddedToPendingPickup(BigInt(guild.id), BigInt(member.id), 'captain_selection');

        if (!addedToCapSelectionPickup) {
            return Util.send(message ? message : interaction, 'error', 'you are not added to any pickup in captain selection stage');
        }

        const pendingPickups = await GuildModel.getPendingPickups(BigInt(guild.id));

        if (pendingPickups) {
            const pendingPickup = pendingPickups.get(guild.id)
                .find(pending => {
                    return pending.stage === 'captain_selection'
                        && (pending.players
                            .map(p => p.id)
                            .includes(member.id))
                });

            if (!pendingPickup) {
                return;
            }

            const updateCb = guildSettings.captainSelectionUpdateCbs.get(pendingPickup.pickupConfigId);

            if (!updateCb) {
                return;
            }

            const msg = updateCb(member.id, false);

            if (msg) {
                if (interaction) {
                    interaction.reply(msg);
                } else {
                    message.channel.send(msg);
                }
            } else {
                if (interaction) {
                    Util.send(interaction, 'success', `assigned you as captain for pickup **${pendingPickup.name}**, about to start`);
                }
            }

            return;
        }
    }
}

module.exports = command;