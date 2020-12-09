import Discord from 'discord.js';
import PickupStage from '../core/PickupStage';
import { Command, RateablePickup } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'rate',
    category: 'admin',
    shortDesc: 'Rate or rerate the latest rateable pickup, call without arguments to see which pickup will be rated',
    desc: 'Rate or rerate the latest rateable pickup, call without arguments to see which pickup will be rated',
    args: [
        { name: '<team:result>...', desc: 'TeamName:Result, results can be given as W = Win, D = Draw, L = Loss', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        const latestRateablePickup = await PickupModel.getLatestStoredRateEnabledPickup(BigInt(message.guild.id));

        if (!latestRateablePickup) {
            return message.reply('no rateable or rated pickup found');
        }

        if (!params.length) {
            return message.reply(`Pickup **#${latestRateablePickup.pickupId}** - ${latestRateablePickup.name} will be **${latestRateablePickup.isRated ? 'rerated' : 'rated'}**`);
        }

        const givenRatings: { team: string; outcome: string }[] = [];
        const validRatings: { team: string; outcome: 'win' | 'draw' | 'loss' }[] = [];

        for (const rating of params) {
            const parts = rating.split(':').filter(part => !(part === '')).map(part => part.trim().toUpperCase());

            if (parts.length < 2) {
                continue;
            } else {
                const team = parts[0];
                let result = parts[1];

                if (!/^[a-zA-Z]+$/.test(team) || team.length > 1) {
                    continue;
                }

                if (!['W', 'D', 'L'].includes(result)) {
                    continue;
                }

                switch (result) {
                    case 'W': result = 'win'; break;
                    case 'D': result = 'draw'; break;
                    case 'L': result = 'loss';
                }

                givenRatings.push({ team, outcome: result as 'win' | 'draw' | 'loss' });
            }
        }

        let winWithDraw = false;
        let missingDraw = false;
        let multipleWins = false;
        let missingWin = false;

        let amountWins = 0;
        let amountDraws = 0;

        latestRateablePickup.teams.forEach(team => {
            const foundTeam = givenRatings.find(r => r.team === team.name);

            if (foundTeam) {
                // No winning team if the ratings contain a draw
                if ((foundTeam.outcome === 'win' && validRatings.find(t => t.outcome === 'draw')) ||
                    (foundTeam.outcome === 'draw' && validRatings.find(t => t.outcome === 'win'))) {
                    winWithDraw = true;
                    return;
                }

                // At least 2 draw reports required if one given
                if ((foundTeam.outcome !== 'draw') &&
                    (validRatings.length === (latestRateablePickup.teams.length - 1) &&
                        (amountDraws === 1))) {
                    missingDraw = true;
                    return;
                }

                // Only 1 win report allowed
                if (foundTeam.outcome === 'win' && amountWins) {
                    multipleWins = true;
                    return;
                }

                // At least 1 win report required if no draw
                if ((foundTeam.outcome !== 'win') &&
                    (validRatings.length === (latestRateablePickup.teams.length - 1) &&
                        (!amountDraws && !amountWins))) {
                    missingWin = true;
                    return;
                }

                switch (foundTeam.outcome) {
                    case 'win': amountWins++; break;
                    case 'draw': amountDraws++; break;
                }

                validRatings.push(foundTeam as { team: string; outcome: 'win' | 'draw' | 'loss' });
            }
        });

        if (validRatings.length !== latestRateablePickup.teams.length) {
            return message.reply(
                'invalid ratings provided\n' +
                `${winWithDraw ? '- Ratings with a draw can\'t contain wins\n' : ''}` +
                `${missingDraw ? '- There have to be at least two draw reports\n' : ''}` +
                `${multipleWins ? '- Only one win report allowed\n' : ''}` +
                `${missingWin ? '- There has to be at least one win if no draws given' : ''}`
            );
        }

        // Make sure the ratings differ from the current ones
        if (latestRateablePickup.isRated) {
            let diffRatings = false;
            for (const team of latestRateablePickup.teams) {
                const givenRating = validRatings.find(r => r.team === team.name);

                if (givenRating.outcome !== team.outcome) {
                    diffRatings = true;
                    break;
                }
            }

            if (!diffRatings) {
                return message.reply('the given ratings are equal to the current ratings');
            }
        }

        // Push ratings to pickup
        for (const rating of validRatings) {
            const team = latestRateablePickup.teams.find(t => t.name === rating.team);
            team.outcome = rating.outcome;
        }

        // Rerate
        if (latestRateablePickup.isRated) {
            await rateMatch(true, message, latestRateablePickup);
        } else {
            // New rating
            await rateMatch(false, message, latestRateablePickup);
        }
    }
}

const rateMatch = async (rerate: boolean, message: Discord.Message, pickup: RateablePickup) => {
    if (rerate) {
        await PickupStage.rateMatch(true, message.guild.id, pickup);
    } else {
        await PickupStage.rateMatch(false, message.guild.id, pickup);
    }

    const results = pickup.teams.map(t => `Team ${t.name} - **${t.outcome.toUpperCase()}**`).join(' / ');
    message.channel.send(`${rerate ? 'Rerated' : 'Rated'} pickup **#${pickup.pickupId}** - **${pickup.name}**: ${results}`);
}

module.exports = command;