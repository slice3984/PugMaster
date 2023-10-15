import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';
import PickupState from '../core/pickupState';
import { ApplicationCommandOptionData, ApplicationCommandOptionType, GuildMember, Snowflake } from 'discord.js';
import Bot from '../core/bot';

const command: Command = {
    cmd: 'add',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'pickup',
                    description: 'Pickup to add to',
                    type: ApplicationCommandOptionType.String,
                    choices: []
                }
            ];

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();

            enabledPickups.forEach(pickup => {
                options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            });

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'pickup',
    aliases: ['+'],
    shortDesc: 'Add to one or multiple pickups',
    desc: 'Add to one or multiple pickups',
    args: [
        { name: '[pickup]...', desc: 'Name of the pickup', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as GuildMember : message.member;

        // Trust check
        const guildSettings = bot.getGuild(guild.id);

        if (guildSettings.explicitTrust) {
            const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(guild.id), member.id);

            if (!alreadyTrusted.length) {
                const playedBefore = await PickupModel.playedBefore(BigInt(guild.id), BigInt(member.id));

                if (!playedBefore) {
                    return Util.send(message ? message : interaction, 'warn', 'no previous pickup game found for you, you need to be trusted to add');
                }
            }
        }

        if (guildSettings.trustTime) {
            const trustTime = guildSettings.trustTime;
            const joinDate = member.joinedAt;
            const timeLeft = (joinDate.getTime() + trustTime) - new Date().getTime();
            if (timeLeft > 0) {
                // Check if already trusted
                const alreadyTrusted = await PlayerModel.arePlayersTrusted(BigInt(guild.id), member.id);

                if (alreadyTrusted.length === 0) {
                    return Util.send(message ? message : interaction, 'warn', `you joined this server recently, please wait ${Util.formatTime(Math.abs(timeLeft))}`);
                }
            }
        }

        // Ban check
        const isBanned = await PlayerModel.isPlayerBanned(BigInt(guild.id), BigInt(member.id));
        if (isBanned) {
            if (isBanned.ends_at) {
                const timeDif = isBanned.ends_at.getTime() - new Date().getTime();
                return Util.send(message ? message : interaction, 'error', `you are banned, time left: ${Util.formatTime(timeDif)} ${isBanned.reason ? ', reason: ' + isBanned.reason : ''}`);

            } else {
                return Util.send(message ? message : interaction, 'error', `you are permbanned${isBanned.reason ? ', reason: ' + isBanned.reason : ''}`);
            }
        }

        const roleCheck = async (...pickupIds) => {
            const userRoles = member.roles.cache;
            const invalidPickups = [];

            for (const id of pickupIds) {
                const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), id);
                const guildSettings = bot.getGuild(guild.id);

                // Pickup settings
                if (pickupSettings.allowlistRole) {
                    if (!userRoles.has(pickupSettings.allowlistRole.toString() as Snowflake)) {
                        invalidPickups.push(id);
                        continue;
                    }
                } else if (pickupSettings.denylistRole) {
                    if (userRoles.has(pickupSettings.denylistRole.toString() as Snowflake)) {
                        invalidPickups.push(id);
                        continue;
                    }
                }

                // Guild defaults
                if (guildSettings.allowlistRole) {
                    if (!userRoles.has(guildSettings.allowlistRole.toString() as Snowflake)) {
                        invalidPickups.push(id);
                        continue;
                    }
                } else if (guildSettings.denylistRole) {
                    if (userRoles.has(guildSettings.denylistRole.toString() as Snowflake)) {
                        invalidPickups.push(id);
                    }
                }
            }

            return invalidPickups;
        }

        await Util.setLock(guildSettings, 'ADD');

        // Don't allow to add when the player is added to a pickup in manual picking stage
        const isInPickingStage = await PickupModel.isPlayerAddedToPendingPickup(BigInt(guild.id), BigInt(member.id), 'picking_manual', 'mapvote', 'captain_selection');

        if (isInPickingStage) {
            return Util.send(message ? message : interaction, 'error', 'you are not allowed to add to pickups when added to a pickup in pending stage');
        }

        if (params.length === 0) {
            if (!await PickupModel.getStoredPickupCount(BigInt(guild.id))) {
                if (interaction) {
                    await Util.send(interaction, 'error', 'this server got no enabled pickups');
                }

                Util.unlock(guildSettings, 'ADD');
                return;
            }

            const playerAddedTo = await PickupModel.isPlayerAdded(BigInt(guild.id), BigInt(member.id));
            const activeAndDefaultPickups = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id), true)).values());

            let validPickups = activeAndDefaultPickups
                .filter(pickup => !(playerAddedTo.includes(pickup.configId) || pickup.maxPlayers <= 2 || pickup.players.length === pickup.maxPlayers)) // Only autoadd on 2+ player pickups
                .map(pickup => pickup.configId);

            if (validPickups.length === 0) {
                if (interaction) {
                    await Util.send(interaction, 'error', 'no suitable pickup found for auto adding');
                }

                Util.unlock(guildSettings, 'ADD');
                return;
            }

            const invalidPickups = await roleCheck(...validPickups);
            validPickups = validPickups.filter(id => !invalidPickups.includes(id));

            if (invalidPickups.length) {
                const invalidPickupNames = [...activeAndDefaultPickups].filter(pickup => invalidPickups.includes(pickup.configId))
                    .map(pickup => pickup.name);

                Util.send(message ? message : interaction, 'error', `you are not allowed to add to ${invalidPickupNames.join(', ')} (Allowlist / Denylist)`);
            }

            if (validPickups.length === 0) {
                Util.unlock(guildSettings, 'ADD');
                return;
            }

            await PlayerModel.storeOrUpdatePlayer(BigInt(guild.id), BigInt(member.id), member.displayName);
            await PickupState.addPlayer(member, interaction, ...validPickups);
            Util.unlock(guildSettings, 'ADD');
        } else {
            const existingPickups = await PickupModel.areValidPickups(BigInt(guild.id), true, ...params);

            if (existingPickups.length === 0) {
                Util.unlock(guildSettings, 'ADD');
                return;
            }

            const activeAndDefaultPickups = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id), true)).values());

            let alreadyAdded = false;
            let isPending = false;
            let pickupName;

            let validPickups = existingPickups.filter(pickup => {
                const activePickup = activeAndDefaultPickups.find(pu => pu.configId === pickup.id);

                if (activePickup) {
                    // Already added to the pickup
                    if (activePickup.players.map(player => player.id).includes(member.id)) {
                        alreadyAdded = true;
                        pickupName = activePickup.name;
                        return false;
                    }

                    // Pickup is full and in pending state
                    if (activePickup.maxPlayers === activePickup.players.length) {
                        isPending = true;
                        pickupName = activePickup.name;
                        return false;
                    }
                }
                return true;
            });

            if (validPickups.length === 0) {
                if ((alreadyAdded || isPending) && interaction) {
                    if (alreadyAdded) {
                        await Util.send(interaction, 'error', `you are already added to pickup **${pickupName}**`);
                    } else {
                        await Util.send(interaction, 'error', `not able to add to pending pickup **${pickupName}**`);
                    }
                }
                Util.unlock(guildSettings, 'ADD');
                return;
            }

            const invalidPickups = await roleCheck(...validPickups.map(pickup => pickup.id));

            if (invalidPickups.length) {
                const invalidPickupNames = validPickups.filter(pickup => invalidPickups.includes(pickup.id))
                    .map(pickup => pickup.name);

                Util.send(message ? message : interaction, 'error', `you are not allowed to add to ${invalidPickupNames.join(', ')} (Allowlist / Denylist)`);
            }

            validPickups = validPickups.filter(pickup => !invalidPickups.includes(pickup.id));

            if (validPickups.length === 0) {
                Util.unlock(guildSettings, 'ADD');
                return;
            }

            await PlayerModel.storeOrUpdatePlayer(BigInt(guild.id), BigInt(member.id), member.displayName);
            await PickupState.addPlayer(member, interaction, ...validPickups.map(pickup => pickup.id))
            Util.unlock(guildSettings, 'ADD');
        }
    }
};

module.exports = command;