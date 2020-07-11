import Discord from 'discord.js';
import PickupModel from "../models/pickup";
import PickupState from './pickupState';
import Util from './util';
import GuildModel from '../models/guild';
import StatsModel from '../models/stats';

export default class PickupStage {
    private constructor() { }


    static async handle(guild: Discord.Guild, pickupConfigId: number) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), pickupConfigId);

        // Afk check
        if (pickupSettings.afkCheck) {
            PickupStage.afkCheckStage(guild, pickupConfigId);
            return;
        }

        // Pick mode
        switch (pickupSettings.pickMode) {
            case 'no_teams':
                PickupStage.startPickup(guild, pickupConfigId);
                break;
            case 'manual':

                break;
            case 'elo':
            // TODO: Generate teams and call startPickup with generated teams
        }
    }

    static async startPickup(guild: Discord.Guild, pickupConfigId: number, teams?: bigint[][], captains?: bigint[]) {
        const aboutToStart = Array.from(await (await PickupModel.getActivePickups(BigInt(guild.id), false)).values())
            .find(pickup => pickup.configId === pickupConfigId);

        const addedPlayers = aboutToStart.players.map(player => player.id);

        let players;

        if (teams) {
            players = teams;
        } else {
            players = addedPlayers;
        }

        // Remove players
        await PickupModel.removePlayers(BigInt(guild.id), ...addedPlayers);

        // Get & parse start message and display that
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guild.id), +aboutToStart.configId);
        const guildSettings = await GuildModel.getGuildSettings(guild);

        const startMessage = await Util.parseStartMessage(BigInt(guild.id), guildSettings.startMessage, pickupSettings, players);

        if (startMessage.length) {
            const pickupChannel = await Util.getPickupChannel(guild);
            await pickupChannel.send(startMessage);
            await PickupState.showPickupStatus(guild);
        }

        // DM players with enabled notifications
        const playersToDm = await GuildModel.getPlayersWithNotify(BigInt(guild.id), ...addedPlayers);

        if (playersToDm.length) {
            const dmMessage = await Util.parseNotifySubMessage(BigInt(guild.id), guildSettings.notifyMessage, pickupSettings);

            if (dmMessage.length) {
                for (const playerId of playersToDm) {
                    const member = guild.members.cache.get(playerId.toString());
                    if (member) {
                        await member.send(dmMessage);
                    }
                }
            }
        }

        await StatsModel.storePickup(BigInt(guild.id), pickupConfigId, players, captains);
    }

    static async afkCheckStage(guild: Discord.Guild, pickupConfigId: number) {

    }
}