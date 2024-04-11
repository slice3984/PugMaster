import { ApplicationCommandOptionData, ApplicationCommandOptionType } from 'discord.js';
import { Command } from '../core/types';
import StatsModel from '../models/stats';
import Util from '../core/util';
import GuildModel from '../models/guild';
import PickupModel from '../models/pickup';
import Bot from '../core/bot';

const command: Command = {
    cmd: 'players',
    applicationCommand: {
        global: false,
        getOptions: async (guild) => {
            const options = [
                {
                    name: 'overall',
                    description: 'Show all active pickup players',
                    type: ApplicationCommandOptionType.Subcommand
                },
                {
                    name: 'pickup',
                    description: 'Show active pickup players for a pickup',
                    type: ApplicationCommandOptionType.Subcommand,
                    options: [
                        {
                            name: 'pickup',
                            description: 'Pickup to get active players for',
                            type: ApplicationCommandOptionType.String,
                            required: true,
                            choices: []
                        }
                    ]
                }
            ]

            const enabledPickups = await Bot.getInstance().getGuild(guild.id).getEnabledPickups();

            enabledPickups.forEach(pickup => {
                options[1].options[0].choices.push({
                    name: pickup.name,
                    value: pickup.name
                });
            })

            return options as ApplicationCommandOptionData[];
        }
    },
    category: 'info',
    shortDesc: 'Shows players who played in the last x days, for a pickup or overall',
    desc: 'Shows players who played in the last x days, for a pickup or overall',
    args: [
        { name: '[pickup]', desc: 'Name of the pickup', required: false }
    ],
    defaults: [
        {
            type: 'number', name: 'period', desc: 'How long the latest pickup can be in the past for a player, given as days',
            value: 14, possibleValues: { from: 1, to: 30 }
        }
    ],
    global: false,
    perms: false,
    exec: async (bot, message, params, defaults, interaction) => {
        const guild = interaction ? interaction.guild : message.guild;

        const limit = defaults[0];
        let pickup;
        let players: { id: string, amount: number }[];

        if (!params.length) {
            players = await StatsModel.getLastActive(BigInt(guild.id), 50, limit);

            if (!players.length) {
                return Util.send(message ? message : interaction, 'info', `no pickups played in past ${defaults[0]} days`);
            }
        } else {
            pickup = params[0].toLowerCase();

            if (!await (await PickupModel.areValidPickups(BigInt(guild.id), true, pickup)).length) {
                return Util.send(message ? message : interaction, 'error', 'invalid pickup provided');
            }

            players = await StatsModel.getLastActive(BigInt(guild.id), 50, limit, pickup);

            if (!players.length) {
                return Util.send(message ? message : interaction, 'info', `no **${pickup}** pickups played in past **${defaults[0]} days**`);
            }
        }

        const online = [];
        const afk = [];
        const dnd = [];

        const addedPlayers: any[] = await GuildModel.getAllAddedPlayers(false, BigInt(guild.id));

        const memberObjs = await Util.getGuildMembers(guild, players
            .filter(p => !addedPlayers.includes(p.id)).map(p => p.id));

        players.forEach(player => {
            const playerObj = memberObjs.find(m => m.id === player.id);

            if (playerObj && playerObj.presence) {
                switch (playerObj.presence.status) {
                    case 'online': online.push({ nick: playerObj.displayName, amount: player.amount }); break;
                    case 'idle': afk.push({ nick: playerObj.displayName, amount: player.amount }); break;
                    case 'dnd': dnd.push({ nick: playerObj.displayName, amount: player.amount }); break;
                }
            }
        });

        if (!online.length && !afk.length && !dnd.length) {
            return Util.send(message ? message : interaction, 'info', 'no online pickup players found');
        }

        const formatArray = arr => arr.map(player => `\`\`${Util.removeMarkdown(player.nick)}\`\` (${player.amount})`);

        Util.send(message ? message : interaction, null,
            `Online and not added${pickup ? ' ' + pickup : ''} pickup players (Added in last ${defaults[0]} days | Limit 50)\n` +
            (online.length ? `:green_circle: ${formatArray(online).join(' ')}\n` : '') +
            (afk.length ? `:orange_circle: ${formatArray(afk).join(' ')}\n` : '') +
            (dnd.length ? `:red_circle: ${formatArray(dnd).join(' ')}` : '')
            , false);
    }
}

module.exports = command;