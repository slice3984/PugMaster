import Discord from 'discord.js';
import Rating from '../core/rating';
import { Command, RateablePickup } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import RatingModel from '../models/rating';

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
                return message.channel.send(Util.formatMessage('error', `${message.author}, pickup id has to be a number`));
            }

            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), BigInt(message.author.id), +params[0]);
        } else {
            latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id), BigInt(message.author.id));
        }

        if (!latestUnratedPickup || latestUnratedPickup.isRated) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no rateable pickup found`));
        }

        const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

        if (Date.now() > endTimestamp) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, the pickup is too old, you can only report draws for pickups less than **${Util.formatTime(guildSettings.reportExpireTime)}** old`));
        }

        const captain = latestUnratedPickup.captains.find(captain => captain.id === message.member.id);

        if (!captain) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you are not a captain of the latest unrated pickup`));
        }

        const reports = await PickupModel.getReportedOutcomes(latestUnratedPickup.pickupId);

        if (reports && reports.filter(r => r.team === captain.team).length) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, you already rated this pickup`));
        }

        const amountFollowingPickups = await RatingModel.getAmountOfFollowingPickups(BigInt(message.guild.id), latestUnratedPickup.pickupConfigId, latestUnratedPickup.pickupId);

        if (amountFollowingPickups > Rating.RERATE_AMOUNT_LIMIT) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, the given pickup is too far in the past, it is only possible to report outcomes for pickups less than ${Rating.RERATE_AMOUNT_LIMIT} rated pickups in the past`));
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

        await message.channel.send(Util.formatMessage('success', `Reported draw for **team ${captain.alias || captain.team}** @ **#${latestUnratedPickup.pickupId}** - **${latestUnratedPickup.name}**`));

        // Last report, rate the pickup
        if (!leftCaptainCount) {
            reports.forEach(report => latestUnratedPickup.teams.find(t => t.name === report.team).outcome = report.outcome);

            const draw = latestUnratedPickup.teams.find(t => t.name === captain.team);
            draw.outcome = 'draw';

            return await rateMatch(message, latestUnratedPickup);
        }

        // If there is only 1 rating left and only 1 draw reported, ask for draw report to finalize
        if (leftCaptainCount === 1 && reports.filter(r => r.outcome === 'draw').length < 2) {
            return await message.channel.send(Util.formatMessage('info', `<@${leftCaptains[0].id}> please **${prefix}reportdraw** to finalize the rating`));
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
    const toSend = await Rating.rateMatch(message.guild.id, pickup);
    message.channel.send(toSend);
}

module.exports = command;