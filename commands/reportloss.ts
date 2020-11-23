import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'reportloss',
    aliases: ['rl'],
    category: 'pickup',
    shortDesc: 'Report a loss as captain for the last rated pickup you played in',
    desc: 'Report a loss as captain for the last rated pickup you played in',
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);
        const prefix = guildSettings.prefix;

        const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), false);

        if (!latestUnratedPickup) {
            return message.reply('no rateable pickup found');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return message.reply(`the pickup is too old, you can only report losses for pickups less than ${Util.formatTime(guildSettings.reportExpireTime)} old`);
        }

        const captain = latestUnratedPickup.captains.find(captain => captain.id === message.member.id);

        if (!captain) {
            return message.reply('you are not a captain of the latest unrated pickup');
        }

        const reports = await PickupModel.getReportedOutcomes(latestUnratedPickup.pickupId);

        if (reports && reports.filter(r => r.team === captain.team).length) {
            return message.reply('you already rated this pickup');
        }

        if (latestUnratedPickup.teams.length === 2) {
            await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'loss');
            await message.reply(`reported loss for **team ${captain.team}**`);
            // TODO: Rate pickup
        } else {
            // In case of more than 2 teams other teams have to report as well
            let leftCaptains;

            if (reports) {
                reports.push({ team: captain.team, outcome: 'loss' });

                leftCaptains = latestUnratedPickup.captains.filter(c => {
                    return !reports
                        .map(report => report.team)
                        .includes(c.team);
                });

                if (reports.length >= latestUnratedPickup.teams.length - 1) {
                    const drawReports = reports.filter(report => report.outcome === 'draw');

                    // Final report, check if it has to be draw
                    if (reports.length === latestUnratedPickup.teams.length && drawReports.length < 2) {
                        return await message.reply(`it is not possible to report loss, please ${prefix}reportdraw to finalize the rating`);
                    }

                    await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'loss');
                    await message.reply(`reported loss for **team ${captain.team}**`);

                    // Pickup is ready to be rated, only 1 report left after this report
                    if ((reports.length === latestUnratedPickup.teams.length - 1) && drawReports.length) {
                        // Only left possible report is draw, ask the left captain to finalize with reporting draw
                        if (drawReports.length < 2) {
                            return await message.channel.send(`<@${leftCaptains[0].id}> please ${prefix}reportdraw to finalize the rating`);
                        } else {
                            return await message.channel.send(`<@${leftCaptains[0].id}> please ${prefix}reportdraw or ${prefix}reportloss to finalize the rating`);
                        }
                    }
                    // TODO: Rate pickup
                    return;
                }
            } else {
                // No reported outcomes so far
                leftCaptains = latestUnratedPickup.captains
                    .filter(c => c !== captain);
            }

            const leftCaptainCount = leftCaptains.length;

            await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'loss');

            await message.reply(`reported loss for **team ${captain.team}**`);

            await message.channel.send(
                `Waiting for ${leftCaptainCount - 1} ${leftCaptainCount > 2 ? 'captains' : 'captain'} ` +
                `to ${prefix}reportloss or ${prefix}reportdraw for pickup ` +
                `**#${latestUnratedPickup.pickupId} - ${latestUnratedPickup.name}** ` +
                `(${leftCaptains.map(captain => `<@${captain.id}>`).join(', ')})`
            );
        }
    }
}

module.exports = command;