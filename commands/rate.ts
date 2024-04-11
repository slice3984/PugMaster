import { Permissions, ButtonInteraction, GuildMember, MessageActionRowComponent, TextChannel, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle } from 'discord.js';
import Rating from '../core/rating';
import { Command, RateablePickup } from '../core/types';
import Util from '../core/util';
import PermissionModel from '../models/permission';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'rate',
    cooldown: 10,
    category: 'admin',
    shortDesc: 'Rate or rerate the current pickup or upto 10 rated pickups in the past',
    desc: 'Rate or rerate the current pickup or upto 10 rated pickups in the past',
    args: [
        { name: '[id]', desc: 'Id of the pickup to rate/rerate', required: false },
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const guildSettings = bot.getGuild(message.guild.id);

        if (guildSettings.activePrompts.has('rate')) {
            return Util.send(message, 'error', 'there is already a active prompt, wait until the prompt timed out or actions were made');
        }

        let rateablePickup: RateablePickup = null;

        if (params.length) {
            if (!/^\d+$/.test(params[0])) {
                return Util.send(message, 'error', 'pickup id has to be a number');
            }

            rateablePickup = await PickupModel.getStoredRateEnabledPickup(BigInt(message.guild.id), +params[0]);

            if (!rateablePickup) {
                return Util.send(message, 'error', `no rateable or rated pickup found with id **${params[0]}**`);
            }
        } else {
            rateablePickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id));
        }

        if (!rateablePickup) {
            return Util.send(message, 'error', 'no rateable pickup found on this server');
        }

        let currTeamIdx = 0;
        let currentTeam = rateablePickup.teams[currTeamIdx];

        const teamNicks = rateablePickup.teams[currTeamIdx].players.map(p => p.nick);
        const generatedPrompt = generateRatingEmbed(rateablePickup, currentTeam.alias || currentTeam.name, teamNicks, [], ['won', 'lost', 'drew'])
        const ratingPrompt = await message.channel.send({ embeds: [generatedPrompt.embed], components: [new ActionRowBuilder<any>().addComponents(generatedPrompt.components)] });

        const collector = ratingPrompt.createMessageComponentCollector({
            time: 30000, filter:
                async i => {
                    const member = i.member as GuildMember;
                    return member.id === message.author.id;
                }
        });

        const previousOutcomes = rateablePickup.teams.map(t => ({ team: t.name, outcome: t.outcome }));
        const currentOutcomes = rateablePickup.teams.map(t => ({ team: t.name, outcome: null }));

        guildSettings.activePrompts.add('rate');

        collector.on('collect', async (i: ButtonInteraction) => {
            const rate = async () => {
                collector.stop();

                // Check if new outcomes differ from old in case of rerating
                let equalOutcomes = previousOutcomes.filter(prevO => {
                    const currOutcome = currentOutcomes.find(o => o.team === prevO.team);
                    return currOutcome.outcome === prevO.outcome;
                });

                if (equalOutcomes.length === rateablePickup.teams.length) {
                    return Util.send(message, 'error', 'Given reports are equal to the current rating', false);
                }

                const toSend = await Rating.rateMatch(message.guild.id, rateablePickup);

                if (toSend instanceof EmbedBuilder) {
                    message.channel.send({ embeds: [toSend] });
                } else {
                    Util.send(message, 'none', toSend, false);
                }
            };

            const member = i.member as GuildMember;

            if (!member.permissions.has([PermissionFlagsBits.Administrator])) {
                const userRoleIds = member.roles.cache.map(strId => BigInt(strId.id));

                if (userRoleIds.length > 0) {
                    // Check if one of the user roles got the required permission
                    const gotPerms = await PermissionModel.guildRolesGotCommandPermission(BigInt(member.guild.id), 'rate', ...userRoleIds);

                    if (!gotPerms) {
                        try {
                            collector.stop();
                            await i.channel.send(Util.formatMessage('error', `${member.toString()}, insufficient permissions, aborted.`));
                        } catch (_) { }
                        return;
                    }
                }
            }

            if (i.customId === 'abort') {
                await Util.send(i.channel as TextChannel, 'info', 'Rating aborted');

                return collector.stop();
            }

            let winReports = 0;
            let drawReports = 0;
            let lossReports = 0;

            currentTeam.outcome = i.customId as 'win' | 'draw' | 'loss';
            currentOutcomes[currTeamIdx].outcome = i.customId;

            currentOutcomes.forEach(outcome => {
                if (outcome.outcome) {
                    switch (outcome.outcome) {
                        case 'win':
                            winReports++;
                            break;
                        case 'draw':
                            drawReports++;
                            break;
                        case 'loss':
                            lossReports++;
                    }
                }
            });

            // If there is only one team left, let the bot figure out the outcome
            if (rateablePickup.teams.length - (currTeamIdx + 1) === 1
                && ((winReports > 0 || lossReports > 0 || drawReports > 0) && drawReports < 2)) {
                if (drawReports === 1) {
                    rateablePickup.teams[currTeamIdx + 1].outcome = 'draw';
                    currentOutcomes[currTeamIdx + 1].outcome = 'draw';
                } else if (lossReports === 1 && !winReports) {
                    rateablePickup.teams[currTeamIdx + 1].outcome = 'win';
                    currentOutcomes[currTeamIdx + 1].outcome = 'win';
                } else if (winReports === 1) {
                    rateablePickup.teams[currTeamIdx + 1].outcome = 'loss';
                    currentOutcomes[currTeamIdx + 1].outcome = 'loss';
                }

                rate();
            } else if (rateablePickup.teams.length - (currTeamIdx + 1) === 0) {
                // All ratings already available, rate the pickup
                rate();
            } else {
                let options = [];

                if (winReports) {
                    options.push('lost', 'drew');
                } else {
                    options.push('won', 'lost', 'drew');
                }

                if (rateablePickup.teams.length > currTeamIdx) {
                    currTeamIdx++;
                }

                currentTeam = rateablePickup.teams[currTeamIdx];

                const teamNicks = rateablePickup.teams[currTeamIdx].players.map(p => p.nick);
                const filteredOutcomes = currentOutcomes.filter(outcome => outcome.outcome);

                const generatedPrompt = generateRatingEmbed(rateablePickup, currentTeam.alias || currentTeam.name, teamNicks, filteredOutcomes, options)
                ratingPrompt.edit({ embeds: [generatedPrompt.embed], components: [new ActionRowBuilder<any>().addComponents(generatedPrompt.components)] });
            }

            i.deferUpdate();
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'time') {
                await Util.send(message, 'info', 'rating prompt expired');
            }

            guildSettings.activePrompts.delete('rate');

            try {
                await ratingPrompt.delete();
            } catch (_) { }
        });
    }
}

const generateRatingEmbed = (pickup: RateablePickup, teamName: string, teamPlayers: string[],
    currentReports: { team: string; outcome: string }[], options: Array<'won' | 'lost' | 'drew'>): { embed: EmbedBuilder, components: MessageActionRowComponent[] } => {
    const rows = [];

    rows.push({ name: `Team **${teamName}**`, value: `\u200B`, inline: true });
    rows.push({ name: '\u200B', value: `\u200B`, inline: true });
    rows.push({ name: '\u200B', value: `\u200B`, inline: true });

    let rowNum = 0;
    while (teamPlayers.length) {
        if (rowNum === 3) {
            rowNum = 0;
        }

        rows[rowNum].value += `${teamPlayers.shift()}\n`;
        rowNum++;
    }

    const rowComponents = [];

    options.forEach(option => {
        switch (option) {
            case 'won':
                rowComponents.push(
                    new ButtonBuilder()
                        .setCustomId('win')
                        .setLabel('WON')
                        .setStyle(ButtonStyle.Success)
                );
                break;
            case 'lost':
                rowComponents.push(
                    new ButtonBuilder()
                        .setCustomId('loss')
                        .setLabel('LOST')
                        .setStyle(ButtonStyle.Danger)
                );
                break;
            case 'drew':
                rowComponents.push(
                    new ButtonBuilder()
                        .setCustomId('draw')
                        .setLabel('DREW')
                        .setStyle(ButtonStyle.Secondary)
                );
                break;
        }
    });

    rowComponents.push(new ButtonBuilder()
        .setCustomId('abort')
        .setLabel('Abort rating')
        .setStyle(ButtonStyle.Primary));

    const embed = new EmbedBuilder()
        .setTitle(`${Util.getBotEmoji('info')} Rating report for pickup **${pickup.pickupId}** - **${pickup.name}**`)
        .setColor('#126e82');

    if (currentReports.length) {
        // Display outcomes instead of time
        let formattedOutcomes = [];

        currentReports.forEach(report => {
            const teamName = report.team;
            formattedOutcomes.push(`${teamName}: **${report.outcome}**`);
        });

        embed.addFields([{ name: 'Current reports', value: formattedOutcomes.join(' '), inline: false}]);
    } else {
        const agoSince = new Date().getTime() - pickup.startedAt.getTime();
        embed.addFields([{ name: 'Time', value: `${Util.formatTime(agoSince)} ago`,inline: false}] );
    }

    embed.addFields(rows)
        .addFields([{ name: '\u200B', value: `Report the outcome of **team ${teamName}** using the buttons`, inline: false}]);

    return {
        embed,
        components: rowComponents
    };
}

module.exports = command;