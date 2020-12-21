import http from 'http';
import path from 'path';
import Discord from 'discord.js';
import socketIO from 'socket.io';
import express from 'express';
import Bot from './core/bot';
import DevModel from './models/dev';
import PickupModel from './models/pickup';
import PickupState from './core/pickupState';
import StatsModel from './models/stats';
import Util from './core/util';

export default class DevPage {
    private botInstance: Bot;
    private server: http.Server;
    private expressApp: express.Application;
    private wss: socketIO.Server;

    constructor(server: http.Server, expressApp: express.Application, bot: Bot) {
        this.server = server;
        this.wss = socketIO(this.server);
        this.expressApp = expressApp;
        this.botInstance = bot;

        this.serveWebsite();
        this.requestHandler();
    }

    private serveWebsite() {
        this.expressApp.use('/www/dev', express.static(path.join(__dirname, 'dist', 'www', 'dev')));

        this.expressApp.get('/dev', (req: express.Request, res: express.Response) => {
            res.sendFile(path.resolve('./www/dev/index.html'));
        })
    }

    private requestHandler() {
        this.wss.on('connection', async (socket: socketIO.Socket) => {
            socket.on('init', async () => {
                let initData: GuildData[] | string = await this.getGuildData();
                initData = JSON.stringify(initData, (key, value) => typeof value === 'bigint' ? value.toString() : value);

                socket.emit('init-data', initData);
            });

            socket.on('add', async receivedData => {
                const data = JSON.parse(receivedData);
                await this.addToPickup(data.guild, data.userId, data.configId);
                socket.emit('guild-update', await this.getSingleGuild(data.guild));
            });

            socket.on('remove', async receivedData => {
                const data = JSON.parse(receivedData);
                await this.removeFromPickup(data.guildId, data.userId, data.configId);
                socket.emit('guild-update', await this.getSingleGuild(data.guildId));
            });

            socket.on('fakestart', async receivedData => {
                const data = JSON.parse(receivedData);
                const response = await this.fakeStart(data.guildId, data.configId);
                socket.emit('fakestart-response', response);
            });

            socket.on('clear', async receivedData => {
                const data = JSON.parse(receivedData);
                await this.clearPickup(data.guild, data.configId);
                socket.emit('guild-update', await this.getSingleGuild(data.guild));
            });

            socket.on('get-guild', async receivedData => {
                const guild = await this.getInitData(receivedData);
                const guildData = JSON.stringify(guild, (key, value) => typeof value === 'bigint' ? value.toString() : value);
                socket.emit('guild-update', guildData);
            });

            socket.on('create-user', async receivedData => {
                await DevModel.generateFakeUser(BigInt(receivedData));
                socket.emit('guild-update', await this.getSingleGuild(receivedData));
            });

            socket.on('remove-user', async receivedData => {
                await DevModel.removeFakeUser(BigInt(receivedData));
                socket.emit('guild-update', await this.getSingleGuild(receivedData));
            });

            socket.on('offline-event', async receivedData => {
                const data = JSON.parse(receivedData);
                const oldPresence = {} as Discord.Presence;
                const newPresence = {
                    status: 'offline',
                    guild: this.botInstance.getClient().guilds.cache.get(data.guild),
                    member: {
                        id: data.player.id,
                        displayName: data.player.name
                    }
                } as Discord.Presence;

                this.botInstance.getClient().emit('presenceUpdate', oldPresence, newPresence);
            });

            socket.on('remove-event', async receivedData => {
                const data = JSON.parse(receivedData);
                const member = {
                    id: data.player.id,
                    displayName: data.player.name,
                    guild: this.botInstance.getClient().guilds.cache.get(data.guild)
                } as Discord.GuildMember;

                this.botInstance.getClient().emit('guildMemberRemove', member);
            });

            socket.on('clear-rated', async guildId => {
                console.log(guildId);
                await DevModel.unrateAllPickups(BigInt(guildId));
            });

            socket.on('delete-all', async guildId => {
                await DevModel.clearAllStoredPickups(BigInt(guildId));
            });
        });
    }

    private async getSingleGuild(guildId: string) {
        const guild = await this.getInitData(guildId);
        const guildData = JSON.stringify(guild, (key, value) => typeof value === 'bigint' ? value.toString() : value);
        return guildData;
    }

    private async getInitData(guildId: string) {
        const guildObj = this.botInstance.getClient().guilds.cache.get(guildId);
        const id = guildObj.id;
        const name = guildObj.name;
        const fakeUsers = await DevModel.getFakeUsers(BigInt(guildId));
        const allPickups = await PickupModel.getAllPickups(BigInt(guildId));
        const activePickups = Array.from(await (await PickupModel.getActivePickups(BigInt(guildId), true)).values());

        const data: GuildData = {
            id,
            name,
            fakeUsers,
            activePickups,
            allPickups
        }

        return data;
    }

    private async getGuildData(): Promise<GuildData[]> {
        const guildIds = this.botInstance.getClient().guilds.cache.map(guild => guild.id);
        const guilds: GuildData[] = [];

        for (const guildId of guildIds) {
            guilds.push(await this.getInitData(guildId));
        }

        return guilds;
    }

    private async addToPickup(guildId: string, userId: string, configId: number) {
        const fakeUser = {
            id: userId,
            guild: this.botInstance.getClient().guilds.cache.get(guildId)
        } as Discord.GuildMember;

        await PickupState.addPlayer(fakeUser, configId);
    }

    private async removeFromPickup(guildId: string, userId: string, configId: number) {
        await PickupState.removePlayer(guildId, userId, true, configId);
    }

    private async fakeStart(guildId: string, configId: number) {
        const pickupSettings = await PickupModel.getPickupSettings(BigInt(guildId), configId);
        const avaialbleFakePlayers = Util.shuffleArray(await DevModel.getFakeUsers(BigInt(guildId)));

        if (pickupSettings.playerCount > avaialbleFakePlayers.length) {
            return `Insufficient amount of fake players, need ${pickupSettings.playerCount - avaialbleFakePlayers.length} more fake players`;
        }

        // Generate fake teams if required
        let teams = [];

        if (['random', 'manual'].includes(pickupSettings.pickMode)) {
            for (let i = 0; i < pickupSettings.teamCount; i++) {
                const amountPlayers = pickupSettings.playerCount / pickupSettings.teamCount;
                const team = avaialbleFakePlayers.splice(0, amountPlayers);
                teams.push(team.map(p => BigInt(p.id)));
            }
        } else {
            teams = avaialbleFakePlayers.splice(0, pickupSettings.playerCount).map(p => BigInt(p.id));
        }

        await StatsModel.storePickup(BigInt(guildId), configId, teams);
        return `Created a new ${pickupSettings.name} fake pickup`;
    }

    private async clearPickup(guildId: string, configId: number) {
        await DevModel.clearPickup(BigInt(guildId), configId);
    }
}

interface GuildData {
    id: string,
    name: string,
    fakeUsers: { id: string; name: string }[];
    activePickups: { name: string, players: { id: string | null, nick: string | null }[]; maxPlayers: number; configId: number }[];
    allPickups: { id: number, name: string, added: number, max: number }[];
}