import Discord from 'discord.js';
import PickupStage from '../core/PickupStage';
import { Command, RateablePickup } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'reportdraw',
    aliases: ['rd'],
    category: 'pickup',
    shortDesc: 'Report a draw as captain for the last rated pickup you played in',
    desc: 'Report a draw as captain for the last rated pickup you played in',
    args: [
        { name: '[pickupId]', desc: 'Pickup you want to report for, no argument for the latest unrated pickup you played in', required: false }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults) => {
        const guildSettings = bot.getGuild(message.guild.id);
        const prefix = guildSettings.prefix;

        let latestUnratedPickup: RateablePickup;

        if (params[0]) {
            if (!/^\d+$/.test(params[0])) {
                return message.reply('pickup id has to be a number');
            }

            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), BigInt(message.author.id), +params[0]);
        } else {
            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), BigInt(message.author.id));
        }

        if (!latestUnratedPickup || latestUnratedPickup.isRated) {
            return message.reply('no rateable pickup found');
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return message.reply(`the pickup is too old, you can only report draws for pickups less than ${Util.formatTime(guildSettings.reportExpireTime)} old`);
        }

        const captain = latestUnratedPickup.captains.find(captain => captain.id === message.member.id);

        if (!captain) {
            return message.reply('you are not a captain of the latest unrated pickup');
        }

        const reports = await PickupModel.getReportedOutcomes(latestUnratedPickup.pickupId);

        if (reports && reports.filter(r => r.team === captain.team).length) {
            return message.reply('you already rated this pickup');
        }

        let leftCaptains;

        if (reports.length) {
            reports.push({ team: captain.team, outcome: 'draw' });

            leftCaptains = latestUnratedPickup.captains.filter(c => {
                return !reports
                    .map(report => report.team)
                    .includes(c.team);
            });

            if (reports.length === latestUnratedPickup.teams.length - 1) {

            }
        } else {
            leftCaptains = latestUnratedPickup.captains
                .filter(c => c !== captain);
        }

        const leftCaptainCount = leftCaptains.length;

        await PickupModel.reportOutcome(latestUnratedPickup.pickupId, captain.team, 'draw');

        await message.reply(`reported draw for **team ${captain.team}**`);

        // Last report, rate the pickup
        if (!leftCaptainCount) {
            reports.forEach(report => latestUnratedPickup.teams.find(t => t.name === report.team).outcome = report.outcome);

            const draw = latestUnratedPickup.teams.find(t => t.name === captain.team);
            draw.outcome = 'draw';

            return await rateMatch(message, latestUnratedPickup);
        }

        // If there is only 1 rating left and only 1 draw reported, ask for draw report to finalize
        if (leftCaptainCount === 1 && reports.filter(r => r.outcome === 'draw').length < 2) {
            return await message.channel.send(`<@${leftCaptains[0].id}> please ${prefix}reportdraw to finalize the rating`);
        }

        await message.channel.send(
            `Waiting for ${leftCaptainCount} ${leftCaptainCount > 2 ? 'captains' : 'captain'} ` +
            `to ${prefix}reportloss or ${prefix}reportdraw for pickup ` +
            `**#${latestUnratedPickup.pickupId} - ${latestUnratedPickup.name}** ` +
            `(${leftCaptains.map(captain => `<@${captain.id}>`).join(', ')})`
        );
    }
}

const rateMatch = async (message: Discord.Message, pickup: RateablePickup) => {
    await PickupStage.rateMatch(false, message.guild.id, pickup);
    const results = pickup.teams.map(t => `Team ${t.name} - **${t.outcome.toUpperCase()}**`).join(' / ');
    message.channel.send(`Rated pickup **#${pickup.pickupId}** - **${pickup.name}**: ${results}`);
}

module.exports = command;