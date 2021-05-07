import Discord from 'discord.js';
import { inspect } from "util";
import { Command } from "../core/types";
import Util from "../core/util";
import TeamModel from "../models/teams";

const command: Command = {
    cmd: 'modify_team',
    category: 'admin',
    shortDesc: 'Set, modify or list team names used for pickups with teams',
    desc: 'Set, modify or list team names used for pickups with teams',
    args: [
        { name: '<team:name/list>', desc: 'TeamId:NewName, default teams use the letters A-J, list to show current names', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        if (params.length === 1 && params[0].toLowerCase() === 'list') {
            let currentTeams = await TeamModel.getTeams(BigInt(message.guild.id));

            [...Array(10)].map((_, idx) => String.fromCharCode(idx + 65)).forEach(letter => {
                const found = currentTeams.find(t => t.teamId === letter);

                if (!found) {
                    currentTeams.push({ teamId: letter, name: letter });
                }
            });

            currentTeams = currentTeams.sort((a, b) => a.teamId.charCodeAt(0) - b.teamId.charCodeAt(0));

            const teamsEmbed = new Discord.MessageEmbed()
                .setColor('#126e82')
                .setTitle('Current team names')
                .addFields(
                    { name: 'Team ID', value: currentTeams.map(t => t.teamId).join('\n'), inline: true },
                    { name: 'Name', value: currentTeams.map(t => t.name).join('\n'), inline: true }
                );

            return message.channel.send(teamsEmbed);
        }

        let validTeams: { teamId: string; newName: string }[] = [];
        for (const team of params) {
            const parts = team.split(':').filter(part => !(part === ''));

            if (parts.length < 2) {
                continue;
            } else {
                const teamId = parts[0].toUpperCase();

                if (teamId.length > 1 || !/[A-J]/.test(teamId)) {
                    continue;
                }

                if (/^\d+$/.test(parts[1]) || parts[1].length > 30) {
                    continue;
                }

                if (validTeams.find(t => t.teamId === teamId)) {
                    continue;
                }

                validTeams.push({
                    teamId,
                    newName: parts[1]
                });
            }
        }

        let currentTeams: { teamId: string; name: string }[];

        // Filter out non existing teams, duplicates
        if (validTeams.length) {
            currentTeams = await TeamModel.getTeams(BigInt(message.guild.id));
            validTeams = validTeams.filter(team => !currentTeams.find(t => t.name === team.newName));
        }

        if (!validTeams.length) {
            return message.channel.send(Util.formatMessage('error', `Make sure team names are unique and less than 31 chars long`));
        }

        await TeamModel.modifyTeams(BigInt(message.guild.id), validTeams);
        message.channel.send(Util.formatMessage('success', `Team names modified: ${validTeams.map(t => `**${t.teamId} => ${t.newName}**`).join(', ')}`));
    }
}

module.exports = command;