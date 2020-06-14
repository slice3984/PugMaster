import fs from 'fs';
import path from 'path';
import Discord from 'discord.js';
import ConfigTool from './configTool';
import { Command, GuildSettings } from './types';
import GuildModel from '../models/guild';
import BotModel from '../models/bot';
import PickupModel from '../models/pickup';
import PickupState from './pickupState';
import PlayerModel from '../models/player';
import { time } from 'console';

export default class Bot {
    private static instance: Bot;
    private commands: Map<string, Command> = new Map();
    private guilds: Map<bigint, GuildSettings> = new Map();
    private client: Discord.Client;

    private constructor() {
        this.initBot();
    }

    private async initBot() {
        // Creating new bot instance
        this.client = new Discord.Client();
        this.client.login(ConfigTool.getConfig().bot.token);
        console.log('Bot successfully logged in');

        this.client.on('ready', async () => {
            await this.loadConnectedGuildsSettings();
            // TODO: Refresh state
            await this.registerCommands();
            await this.registerEventListeners();
            this.mainLoop();
        });
    }

    private mainLoop() {
        // TODO: Add checks to make sure nothing fails on member/guild unavailability
        setInterval(async () => {
            const dateInMs = new Date().getTime();
            const leftExpires = new Map();
            const guildsToShowStatus = new Set();

            /************************ Player expires ************************/
            const expires = await GuildModel.getAllExpires();
            const playersToRemoveExpire = new Map();

            expires.forEach(expire => {
                const timeLeft = expire.expiration_date.getTime() - dateInMs;
                if (timeLeft <= 0) {
                    if (playersToRemoveExpire.has(expire.guild_id)) {
                        playersToRemoveExpire.get(expire.guild_id).push(expire.player_id);
                    } else {
                        playersToRemoveExpire.set(expire.guild_id, [expire.player_id]);
                    }
                } else {
                    if (leftExpires.has(expire.guild_id)) {
                        leftExpires.get(expire.guild_id).push(expire.player_id);
                    } else {
                        leftExpires.set(expire.guild_id, [expire.player_id]);
                    }
                }
            });

            const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]`;

            for (const [guild, players] of playersToRemoveExpire.entries()) {
                await PickupModel.removePlayers(BigInt(guild), ...players);
                await PlayerModel.removeExpires(BigInt(guild), ...players);

                const guildObj = this.client.guilds.cache.get(guild);
                const pickupChannel = guildObj.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild))) as Discord.TextChannel;
                const playerObjs = players.map(player => guildObj.members.cache.get(player));

                pickupChannel.send(`${playerObjs.join(', ')} you got removed from all pickups, expire ran out`);
                guildsToShowStatus.add(guild);
            }
            /************************ Global expires ************************/
            const globalExpires = await GuildModel.getAllAddTimes();
            const playersToRemoveGlobalExpire = new Map();

            globalExpires.forEach(expire => {
                const timeLeft = (expire.added_at.getTime() + this.getGuild(expire.guild_id).globalExpireTime) - dateInMs;

                // Ignore players with active expire
                if (timeLeft <= 0) {
                    if (leftExpires.has(expire.guild_id) && leftExpires.get(expire.guild_id).includes(expire.player_id)) {
                        return;
                    }

                    if (playersToRemoveGlobalExpire.has(expire.guild_id)) {
                        playersToRemoveGlobalExpire.get(expire.guild_id).push(expire.player_id);
                    } else {
                        playersToRemoveGlobalExpire.set(expire.guild_id, [expire.player_id]);
                    }
                }
            });

            for (const [guild, players] of playersToRemoveGlobalExpire.entries()) {
                await PickupModel.removePlayers(BigInt(guild), ...players);
                await GuildModel.removeAddTimes(BigInt(guild), ...players);

                const guildObj = this.client.guilds.cache.get(guild);
                const pickupChannel = guildObj.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild))) as Discord.TextChannel;
                const playerObjs = players.map(player => guildObj.members.cache.get(player));

                pickupChannel.send(`${playerObjs.join(', ')} you got removed from all pickups, global expire ran out`);
                guildsToShowStatus.add(guild);
            }
            /************************ AOs ************************/
            const playerAos = await GuildModel.getAllAos();
            const playersToRemoveAos = new Map();

            playerAos.forEach(ao => {
                const timeLeft = ao.expiration_date.getTime() - dateInMs;
                if (timeLeft <= 0) {
                    if (timeLeft <= 0) {
                        if (playersToRemoveAos.has(ao.guild_id)) {
                            playersToRemoveAos.get(ao.guild_id).push(ao.player_id);
                        } else {
                            playersToRemoveAos.set(ao.guild_id, [ao.player_id]);
                        }
                    }
                }
            });


            for (const [guild, players] of playersToRemoveAos.entries()) {
                await PlayerModel.removeAos(BigInt(guild), ...players);

                // Filter out players who are not added to any pickup
                const addedPlayers = await GuildModel.getAllAddedPlayers(BigInt(guild));
                const validPlayers = players.filter(player => addedPlayers.includes(player));

                const guildObj = this.client.guilds.cache.get(guild);
                const pickupChannel = guildObj.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild))) as Discord.TextChannel;

                const toPing = [];
                const toNick = [];

                const toRemoveNick = [];

                for (const player of players.filter(player => !validPlayers.includes(player))) {
                    const playerObj = guildObj.members.cache.get(player);
                    if (playerObj.presence.status === 'offline') {
                        toNick.push(playerObj);
                    } else {
                        toPing.push(playerObj);
                    }
                }

                const toRemoveObjs = [];

                for (const player of validPlayers) {
                    const playerObj = guildObj.members.cache.get(player);
                    // Only remove on offline status
                    if (playerObj.presence.status === 'offline') {
                        toRemoveNick.push(playerObj);
                        toNick.push(playerObj);
                        toRemoveObjs.push(playerObj);
                        guildsToShowStatus.add(guild);
                    } else {
                        toPing.push(playerObj);
                    }
                }

                const toRemoveIds = toRemoveObjs.map(player => player.id);

                if (toRemoveIds.length) {
                    await PickupModel.removePlayers(BigInt(guild), ...toRemoveIds);
                    await GuildModel.removeAddTimes(BigInt(guild), ...toRemoveIds);
                }

                pickupChannel.send(`${toPing.join(', ')} ${toNick.map(player => player.displayName).join(', ')} your allow offline ran out`);

                if (toRemoveIds.length > 0) {
                    pickupChannel.send(`${toRemoveObjs.map(player => player.displayName).join(', ')} you got removed from all active pickups as you are offline`);
                }
            }

            if (guildsToShowStatus.size > 0) {
                for (const guild of guildsToShowStatus) {
                    const pickups = Array.from((await PickupModel.getActivePickups(BigInt(guild))).values())
                        .sort((a, b) => b.players.length - a.players.length);

                    const guildObj = this.client.guilds.cache.get(guild as string);
                    const pickupChannel = guildObj.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild))) as Discord.TextChannel;

                    let msg = '';
                    pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);

                    pickupChannel.send(msg || 'No active pickups');
                }
            }
        }, 10 * 1000);
    }

    private async registerEventListeners() {
        let events = 0;

        const register = async (dir = 'events') => {
            const files = await fs.promises.readdir(path.join(__dirname, dir));

            for (let file of files) {
                let stat = await fs.promises.lstat(path.join(__dirname, dir, file));
                if (stat.isDirectory()) {
                    register(path.join(dir, file));
                } else {
                    let eventName = file.substring(0, file.length - 3);
                    const module: Function = require(path.join(__dirname, dir, file));
                    events++;
                    // @ts-ignore - Required for dynamic event registration
                    this.client.on(eventName, module.bind(null, this));
                }
            }
        };

        await register();
        console.log(`Registered ${events} events`);
    }

    private async registerCommands() {
        let commands = 0;
        const commandFiles = [];
        const storedCommands = await BotModel.getStoredCommands();
        const disabledCommands = storedCommands
            .filter(command => command.disabled)
            .map(command => command.name);


        const register = async (dir = 'commands') => {
            const files = await fs.promises.readdir(path.join(__dirname, '/../', dir));

            for (let file of files) {
                let stat = await fs.promises.lstat(path.join(__dirname, '/../', dir, file));
                if (stat.isDirectory()) {
                    register(path.join(dir, file));
                } else {
                    const module: Command = require(path.join(__dirname, '/../', dir, file));
                    commandFiles.push(module.cmd);

                    if (disabledCommands.includes(module.cmd)) {
                        continue;
                    }

                    // Command not in db, store it
                    if (!storedCommands.some(command => command.name == module.cmd)) {
                        BotModel.storeCommands(module.cmd);
                    }

                    commands++;
                    this.commands.set(module.cmd, module);
                }
            }
        };

        await register();

        // Remove not used commands
        const toRemoveFromDb = storedCommands
            .filter(command => !commandFiles.includes(command.name))
            .map(command => command.name);
        await BotModel.removeCommands(...toRemoveFromDb)

        console.log(`Loaded ${commands} commands`)
    }

    async loadConnectedGuildsSettings() {
        let guildCounter = 0;
        const guilds = this.client.guilds.cache.values();
        for (const guild of guilds) {
            const data = await GuildModel.getGuildSettings(BigInt(guild.id));
            this.guilds.set(BigInt(guild.id), data);
            guildCounter++;
        }
        console.log(`Connected to ${guildCounter} guild${guildCounter > 1 ? 's' : ''}`);
        return;
    }

    getClient(): Discord.Client {
        return this.client;
    }

    static getInstance(): Bot {
        if (!Bot.instance) {
            Bot.instance = new Bot();
        }
        return this.instance;
    }

    addGuild(guild: GuildSettings) {
        if (this.guilds.has(guild.id)) {
            return;
        }
        this.guilds.set(guild.id, guild);
    }

    removeGuild(guildId: string | bigint) {
        const id = (typeof guildId === 'string') ? BigInt(guildId) : guildId;
        this.guilds.delete(id);
    }

    getGuild(guildId: string | bigint) {
        const id = (typeof guildId === 'string') ? BigInt(guildId) : guildId;
        return this.guilds.get(id);
    }

    doesCommandExist(cmd: string) {
        for (const [name, command] of this.commands.entries()) {
            if (command.aliases) {
                const names = [...command.aliases];
                names.push(name);
                if (names.includes(cmd)) {
                    return true;
                }
            }
            if (name === cmd) {
                return true;
            }
        }
        return false;
    }

    getCommand(cmd: string) {
        for (const [name, command] of this.commands.entries()) {
            if (command.aliases) {
                const names = [...command.aliases];
                names.push(name);
                if (names.includes(cmd)) {
                    return command;
                }
            }
            if (name === cmd) {
                return command;
            }
        }
    }

    getCommandNames() {
        return [...this.commands.keys()];
    }
}