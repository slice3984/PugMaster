import Discord from 'discord.js';
import Rating from '../core/rating';
import { Command, RateablePickup } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import RatingModel from '../models/rating';

const command: Command = {
    cmd: 'reportloss',
    applicationCommand: {
        global: true,
        getOptions: () => {
            return [
                {
                    name: 'pickup-id',
                    description: 'Pickup id to report a loss for',
                    type: 'NUMBER'
                }
            ]
        }
    },
    aliases: ['rl'],
    category: 'pickup',
    shortDesc: 'Report a loss as captain for the last rated pickup you played in',
    desc: 'Report a loss as captain for the last rated pickup you played in',
    args: [
        { name: '[pickupId]', desc: 'Pickup you want to report for, no argument for the latest unrated pickup you played in', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;
        const member = interaction ? interaction.member as Discord.GuildMember : message.member;
        const pickupChannel = await Util.getPickupChannel(guild);

        const guildSettings = bot.getGuild(guild.id);
        const prefix = guildSettings.prefix;

        let latestUnratedPickup: RateablePickup;

        if (params[0]) {
            if (!/^\d+$/.test(params[0])) {
                return Util.send(message ? message : interaction, 'error', 'pickup id has to be a number');
            }

            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(guild.id), BigInt(member.id), +params[0]);
        } else {
            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(guild.id), BigInt(member.id));
        }

        if (!latestUnratedPickup || latestUnratedPickup.isRated) {
            return Util.send(message ? message : interaction, 'error', 'no rateable pickup found');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return Util.send(message ? message : interaction, 'error', `the pickup is too old, you can only report losses for pickups less than **${Util.formatTime(guildSettings.reportExpireTime)}** old`);
        }

        const captain = latestUnratedPickup.captains.find(captain => captain.id === member.id);

        if (!captain) {
            return Util.send(message ? message : interaction, 'error', 'you are not a captain of the latest unrated pickup');
        }

        const reports = await PickupModel.getReportedOutcomes(latestUnratedPickup.pickupId);

        if (reports.filter(r => r.team === captain.team).length) {
            return Util.send(message ? message : interaction, 'error', 'you already rated this pickup');
        }

        const amountFollowingPickups = await RatingModel.getAmountOfFollowingPickups(BigInt(guild.id), latestUnratedPickup.pickupConfigId, latestUnratedPickup.pickupId);

        if (amountFollowingPickups > Rating.RERATE_AMOUNT_LIMIT) {
            return Util.send(message ? message : interaction, 'error', `the given pickup is too far in the past, it is only possible to report outcomes for pickups less than ${Rating.RERATE_AMOUNT_LIMIT} rated pickups in the past`);
        }

        const drawReports = reports.filter(report => report.outcome === 'draw');

        if (latestUnratedPickup.teams.length === 2) {
            if (drawReports.length) {
                return Util.send(message ? message : interaction, 'error', `it is not possible to report loss, please ${prefix}reportdraw to finalize the rating`);
            }

            const loss = latestUnratedPickup.teams.find(t => t.name === captain.team);
            loss.outcome = 'loss';
            latestUnratedPickup.teams.find(t => t !== loss).outcome = 'win';

            await Util.send(message ? message : interaction, 'success', `Reported loss for **team ${captain.alias || captain.team}** @ **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`, false);
            await rateMatch(message ? message : interaction, latestUnratedPickup);
        } else {
            // In case of more than 2 teams other teams have to report as well
            let leftCaptains;

            if (reports.length) {
                reports.push({ team: captain.team, outcome: 'loss' });

                leftCaptains = latestUnratedPickup.captains.filter(c => {
                    return !reports
                        .map(report => report.team)
                        .includes(c.team);
                });

                if (reports.length >= latestUnratedPickup.teams.length - 1) {
                    // Final report, check if it has to be draw
                    if (reports.length === latestUnratedPickup.teams.length && drawReports.length < 2) {
                        return Util.send(message ? message : interaction, 'error', `it is not possible to report loss, please ${prefix}reportdraw to finalize the rating`);
                    }

                    // Pickup is ready to be rated, only 1 report left after this report
                    if ((reports.length === latestUnratedPickup.teams.length - 1) && drawReports.length) {
                        await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'loss');
                        await Util.send(message ? message : interaction, 'success', `Reported loss for **team ${captain.alias || captain.team}** @ **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`, false);

                        // Only left possible report is draw, ask the left captain to finalize with reporting draw
                        if (drawReports.length < 2) {
                            return pickupChannel.send(`<@${leftCaptains[0].id}> please ${prefix}reportdraw to finalize the rating`);
                        } else {
                            return pickupChannel.send(`<@${leftCaptains[0].id}> please ${prefix}reportdraw or ${prefix}reportloss to finalize the rating`);
                        }
                    }

                    reports.forEach(report => latestUnratedPickup.teams.find(t => t.name === report.team).outcome = report.outcome);

                    const loss = latestUnratedPickup.teams.find(t => t.name === captain.team);
                    loss.outcome = 'loss';
                    latestUnratedPickup.teams.find(t => t.outcome === null).outcome = 'win';

                    await Util.send(message ? message : interaction, 'success', `Reported loss for **team ${captain.alias || captain.team}** @ **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`, false);
                    return await rateMatch(message ? message : interaction, latestUnratedPickup);
                }
            } else {
                // No reported outcomes so far
                leftCaptains = latestUnratedPickup.captains
                    .filter(c => c !== captain);
            }

            const leftCaptainCount = leftCaptains.length;

            await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'loss');

            await Util.send(message ? message : interaction, 'success', `Reported loss for **team ${captain.alias || captain.team}** @ **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`, false);

            await pickupChannel.send(
                `Waiting for ${leftCaptainCount - 1} ${leftCaptainCount > 2 ? 'captains' : 'captain'} ` +
                `to ${prefix}reportloss or ${prefix}reportdraw for pickup ` +
                `**#${latestUnratedPickup.pickupId} - ${latestUnratedPickup.name}** ` +
                `(${leftCaptains.map(captain => `<@${captain.id}>`).join(', ')})`
            );
        }
    }
}

const rateMatch = async (input: Discord.Message | Discord.CommandInteraction, pickup: RateablePickup) => {
    const toSend = await Rating.rateMatch(input.guild.id, pickup);
    const pickupChannel = await Util.getPickupChannel(input.guild);

    if (toSend instanceof Discord.MessageEmbed) {
        if (pickupChannel) {
            pickupChannel.send({ embeds: [toSend] });
        }
    } else {
        if (pickupChannel) {
            pickupChannel.send(toSend);
        }
    }
}

module.exports = command;