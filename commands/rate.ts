import Rating from '../core/rating';
import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';
import TeamModel from '../models/teams';

const command: Command = {
    cmd: 'rate',
    cooldown: 10,
    category: 'admin',
    shortDesc: 'Rate or rerate the current pickup or upto 10 rated pickups in the past',
    desc: 'Rate or rerate the current pickup or upto 10 rated pickups in the past',
    args: [
        { name: '<id>', desc: 'Id of the pickup to rate/rerate', required: true },
        { name: '<team:result>...', desc: 'TeamName:Result, results can be given as W = Win, D = Draw, L = Loss', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        if (!/^\d+$/.test(params[0])) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, pickup id has to be a number`));
        }

        const rateablePickup = await PickupModel.getStoredRateEnabledPickup(BigInt(message.guild.id), +params[0]);

        if (!rateablePickup) {
            return message.channel.send(Util.formatMessage('error', `${message.author}, no rateable or rated pickup found with id **${params[0]}**`));
        }

        const givenRatings: { team: string; outcome: string }[] = [];
        const validRatings: { team: string; outcome: 'win' | 'draw' | 'loss' }[] = [];

        const teamNames = await TeamModel.getTeams(BigInt(message.guild.id));

        for (const rating of params.slice(1)) {
            const parts = rating.split(':').filter(part => !(part === '')).map(part => part.trim().toUpperCase());

            if (parts.length < 2) {
                continue;
            } else {
                let team = parts[0];
                let result = parts[1];

                const foundTeam = teamNames.find(t => t.name.toUpperCase() === team.toUpperCase());

                if (foundTeam) {
                    team = foundTeam.teamId;
                } else {
                    if (team.length > 1 || !/[a-jA-J]/.test(team)) {
                        continue;
                    }

                    team.toUpperCase();
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

        rateablePickup.teams.forEach(team => {
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
                    (validRatings.length === (rateablePickup.teams.length - 1) &&
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
                    (validRatings.length === (rateablePickup.teams.length - 1) &&
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

        if (validRatings.length !== rateablePickup.teams.length) {
            return message.reply(
                Util.formatMessage('error',
                    'Invalid ratings provided\n' +
                    `${winWithDraw ? '- Ratings with a draw can\'t contain wins\n' : ''}` +
                    `${missingDraw ? '- There have to be at least two draw reports\n' : ''}` +
                    `${multipleWins ? '- Only one win report allowed\n' : ''}` +
                    `${missingWin ? '- There has to be at least one win if no draws given' : ''}`
                )
            );
        }

        // Make sure the ratings differ from the current ones
        if (rateablePickup.isRated) {
            let diffRatings = false;
            for (const team of rateablePickup.teams) {
                const givenRating = validRatings.find(r => r.team === team.name);

                if (givenRating.outcome !== team.outcome) {
                    diffRatings = true;
                    break;
                }
            }

            if (!diffRatings) {
                return message.channel.send(Util.formatMessage('error', `The given ratings are equal to the current ratings of **#${params[0]}** - **${rateablePickup.name}**`));
            }
        }

        // Push ratings to pickup
        for (const rating of validRatings) {
            const team = rateablePickup.teams.find(t => t.name === rating.team);
            team.outcome = rating.outcome;
        }

        const toSend = await Rating.rateMatch(message.guild.id, rateablePickup);
        message.channel.send(toSend);
    }
}

module.exports = command;