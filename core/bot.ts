import fs from 'fs';
import path from 'path';
import Discord from 'discord.js';
import ConfigTool from './configTool';
import { Command } from './types';
import GuildSettings from './guildSettings';
import GuildModel from '../models/guild';
import BotModel from '../models/bot';
import PickupModel from '../models/pickup';
import PlayerModel from '../models/player';
import PickupState from './pickupState';
import Logger from './logger';
import Console from '../console';
import Util from './util';

export default class Bot {
    private botIsReady = false;
    private static instance: Bot;
    private commands: Map<string, Command> = new Map();
    private guilds: Map<bigint, GuildSettings> = new Map();
    private client: Discord.Client;
    private anyPickupPending: boolean = true;

    private constructor() {
        this.initBot();
    }

    private async initBot() {
        // Creating new bot instance
        this.client = new Discord.Client({
            presence: {
                activities: [{
                    name: ConfigTool.getConfig().webserver.domain,
                    type: 'PLAYING'
                }]
            },
            intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_PRESENCES', 'GUILD_MEMBERS', 'GUILD_MESSAGE_REACTIONS']
        });

        this.client.login(ConfigTool.getConfig().bot.token);
        console.log('Bot successfully logged in');

        this.client.on('ready', async () => {
            await this.loadConnectedGuildsSettings();

            const connectedGuilds = [...this.guilds.keys()];
            // Clear pending pickups
            if (connectedGuilds.length) {
                const guildsWithPendingPickups = await GuildModel.getGuildsWithPendingPickups(...connectedGuilds);

                if (guildsWithPendingPickups.length) {
                    await GuildModel.clearPendingPickups();

                    guildsWithPendingPickups.forEach(async guildId => {
                        const guildObj = this.client.guilds.cache.get(guildId as Discord.Snowflake);

                        if (guildObj) {
                            const pickupChannel = await this.getPickupChannel(guildObj);
                            if (pickupChannel) {
                                await pickupChannel.send('**Detected one or more pending pickups, pending pickups cleared due to bot restart**');
                            }
                        }
                    });
                }

            }

            // TODO: Refresh state
            await this.registerCommands();
            await this.registerEventListeners();

            this.mainLoop();
            this.secondaryLoop();
            new Console(this);
            this.botIsReady = true;
        });
    }

    isBotReady() {
        return this.botIsReady;
    }

    private async getPickupChannel(guild: Discord.Guild): Promise<Discord.TextChannel | null> {
        return guild.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild.id))) as Discord.TextChannel;
    }

    private mainLoop() {
        setInterval(async () => {
            const connectedGuilds = [...this.guilds.keys()];
            const dateInMs = new Date().getTime();
            const leftExpires = new Map();
            const guildsToShowStatus = new Set();

            /************************ Player expires ************************/
            const expires = await GuildModel.getAllExpires(...connectedGuilds);
            const playersToRemoveExpire = new Map();

            expires.forEach(expire => {
                const timeLeft = expire.pickup_expire.getTime() - dateInMs;
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
                try {
                    await PickupState.removePlayers(guild, true, null, ...players);
                    const guildObj = this.client.guilds.cache.get(guild);
                    const pickupChannel = await this.getPickupChannel(guildObj);
                    const playerObjs = players.map(player => guildObj.members.cache.get(player));
                    const prefix = this.getGuild(guildObj.id).prefix;

                    if (pickupChannel) {
                        pickupChannel.send(`${playerObjs.join(', ')} you got removed from all pickups, ${prefix}expire ran out`);
                    }

                    guildsToShowStatus.add(guild);
                } catch (err) {
                    Logger.logError('Failed to retrieve required data in expire check', err, true, guild);
                }
            }
            /************************ Global expires ************************/
            const globalExpires = await GuildModel.getAllAddTimes(...connectedGuilds);
            const playersToRemoveGlobalExpire = new Map();

            globalExpires.forEach(expire => {
                try {
                    const timeLeft = (expire.last_add.getTime() + this.getGuild(expire.guild_id).globalExpireTime) - dateInMs;

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
                } catch (err) {
                    Logger.logError('Failed to retrieve required data in global expire check (guild data)', err, true, expire.guild_id);
                }
            });

            for (const [guild, players] of playersToRemoveGlobalExpire.entries()) {
                try {
                    await PickupState.removePlayers(guild, true, null, ...players);
                    const guildObj = this.client.guilds.cache.get(guild);
                    const pickupChannel = await this.getPickupChannel(guildObj);
                    const playerObjs = players.map(player => guildObj.members.cache.get(player));

                    if (pickupChannel) {
                        pickupChannel.send(`${playerObjs.join(', ')} you got removed from all pickups, global expire ran out`);
                    }

                    guildsToShowStatus.add(guild);
                } catch (err) {
                    Logger.logError('Failed to retrieve required data in global expire check', err, true, guild);
                }
            }
            /************************ AOs ************************/
            const playerAos = await GuildModel.getAllAos(...connectedGuilds);
            const playersToRemoveAos = new Map();

            playerAos.forEach(ao => {
                const timeLeft = ao.ao_expire.getTime() - dateInMs;
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
                try {
                    await PlayerModel.removeAos(BigInt(guild), ...players);

                    // Filter out players who are not added to any pickup or a pickup in picking stage
                    const addedPlayers = await GuildModel.getAllAddedPlayers(true, BigInt(guild));
                    const validPlayers = players.filter(player => addedPlayers.includes(player));

                    const guildObj = this.client.guilds.cache.get(guild);
                    const pickupChannel = await this.getPickupChannel(guildObj);

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
                        await PickupState.removePlayers(guild, true, null, ...players);
                    }

                    pickupChannel.send(`${toPing.join(', ')} ${toNick.map(player => `**${player.displayName}**`).join(', ')} your allow offline ran out`);

                    if (toRemoveIds.length > 0) {
                        if (pickupChannel) {
                            pickupChannel.send(`${toRemoveObjs.map(player => `**${player.displayName}**`).join(', ')} you got removed from all active pickups as you are offline`);
                        }
                    }
                } catch (err) {
                    Logger.logError('Failed to retrieve required data in ao expire check', err, true, guild);
                }
            }

            if (guildsToShowStatus.size > 0) {
                for (const guild of guildsToShowStatus) {
                    const pickups = Array.from((await PickupModel.getActivePickups(BigInt(guild as string))).values())
                        .sort((a, b) => b.players.length - a.players.length);

                    try {
                        const guildObj = this.client.guilds.cache.get(guild as Discord.Snowflake);
                        const pickupChannel = await this.getPickupChannel(guildObj);

                        let msg = '';
                        pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);

                        if (pickupChannel) {
                            pickupChannel.send(msg || 'No active pickups');
                        }
                    } catch (err) {
                        Logger.logError('Failed to retrieve required data in main loop pickup status', err, true, guild as string);
                    }
                }
            }
        }, 10 * 1000);
    }

    private secondaryLoop() {
        setInterval(async () => {
            // Clear expired sub requests
            const guildsToClearRequests = [];

            for (const [id, guildSettings] of this.guilds.entries()) {
                const latestUnratedPickup = await PickupModel.getLatestStoredRateEnabledPickup(id);

                if (!latestUnratedPickup || latestUnratedPickup.isRated) {
                    break;
                }

                const endTimestamp = latestUnratedPickup.startedAt.getTime() + guildSettings.reportExpireTime;

                if (Date.now() > endTimestamp) {
                    guildsToClearRequests.push(id);
                }
            }

            if (guildsToClearRequests.length) {
                await GuildModel.clearSubRequests(...guildsToClearRequests);
            }

            // Clear unused state guild players
            await GuildModel.clearUnusedPlayerStates();

            // Clear expired reports
            const reports = await GuildModel.getStateReportTimes();
            const pickupsToClear = [];
            const guildsToCheck = []; // Reports of guilds not in here get cleared as well (disconnected guilds)

            if (reports) {
                for (const [guild, info] of reports) {
                    const guildSettings = this.guilds.get(BigInt(guild));

                    if (!guildSettings) {
                        continue;
                    }

                    const timeoutTime = guildSettings.reportExpireTime;

                    for (const infoObj of info) {
                        if ((infoObj.start.getTime() + timeoutTime) < new Date().getTime()) {
                            pickupsToClear.push(infoObj.pickupId);
                        }
                    }

                    guildsToCheck.push(BigInt(guild));
                }

                await GuildModel.clearStateReports(pickupsToClear, guildsToCheck);
            }

            // Clear guild flood times
            this.guilds.forEach(guild => guild.lastCommandExecutions.clear());
        }, 6 * 60 * 60 * 1000);
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
        let globalApplicationCommandsCount = 0;
        let guildApplicationCommands = 0;

        const commandFiles = [];
        const storedCommands = await BotModel.getStoredCommands();
        const disabledCommands = storedCommands
            .filter(command => command.disabled)
            .map(command => command.name);

        const globalApplicationCommands = await this.client.application.commands.fetch();

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

                    // Register it as application command if required
                    if (module.applicationCommand) {
                        if (module.applicationCommand.global) {
                            // Only create if not created yet
                            const fetchedCommand = globalApplicationCommands.find(c => c.name === module.cmd);

                            const registerApplicationCommand = async () => {
                                try {
                                    await this.client.application.commands.create({
                                        name: module.cmd,
                                        description: module.shortDesc,
                                        options: await module.applicationCommand.getOptions(null)
                                    });

                                    globalApplicationCommandsCount++;
                                } catch (_) { }
                            }

                            if (fetchedCommand) {
                                // Passed register flag, create anyway
                                if (process.argv.length > 2 && process.argv[2] === 'register') {
                                    await registerApplicationCommand();
                                }
                            } else {
                                await registerApplicationCommand();
                            }
                        } else {
                            for (const [id, guild] of this.client.guilds.cache.entries()) {
                                const guildSettings = this.getGuild(id);

                                // Skip when permissions are missing
                                try {
                                    if (!guildSettings.disabledCommands.includes(module.cmd)) {
                                        const applicationCommand = await guild.commands.create({
                                            name: module.cmd,
                                            description: module.shortDesc,
                                            options: await module.applicationCommand.getOptions(guild)
                                        });

                                        this.getGuild(id).applicationCommands.set(module.cmd, applicationCommand);
                                    }

                                    guildApplicationCommands++;
                                } catch (_) { }
                            }
                        }
                    }

                    commands++;
                    this.commands.set(module.cmd, module);
                }
            }
        };

        await register();

        // Remove not used commands
        const unusedCommands = storedCommands.filter(command => !commandFiles.includes(command.name));
        const toRemoveFromDb = unusedCommands.map(command => command.name);

        // Remove from application commands
        // Guild commands
        for (const [id, guild] of this.client.guilds.cache.entries()) {
            let registeredGuildCommands;

            // Unable to fetch when permissions are missing
            try {
                registeredGuildCommands = await guild.commands.fetch();
            } catch (_) { continue; }

            for (const cmd of unusedCommands) {
                const guildCommand = registeredGuildCommands.find(c => c.name === cmd.name);

                if (guildCommand) {
                    try {
                        await guildCommand.delete();
                    } catch (_) { }
                }
            }
        }

        // Global commands
        try {
            for (const cmd of unusedCommands) {
                const globalCommand = globalApplicationCommands.find(c => c.name === cmd.name);

                if (globalCommand) {
                    await globalCommand.delete();
                }
            }
        } catch (_) { }
        await BotModel.removeCommands(...toRemoveFromDb);

        console.log(`Loaded ${commands} commands (${globalApplicationCommandsCount} global / ${globalApplicationCommandsCount} guild application commands)`);
    }

    async loadConnectedGuildsSettings() {
        let guildCounter = 0;
        const guilds = this.client.guilds.cache.values();
        for (const guild of guilds) {
            let data = await GuildModel.getGuildSettings(guild);

            if (!data) {
                const newGuild = await GuildModel.createGuild(guild);
                console.log(`Successfully stored new guild '${newGuild}'`);
                data = await GuildModel.getGuildSettings(guild);
            }

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

    getCommands() {
        return [...this.commands.values()];
    }

    getCommandNames() {
        return [...this.commands.keys()];
    }

    setAnyPickupPending(isPending: boolean) {
        this.anyPickupPending = isPending;
    }

    isAnyPickupPending() {
        return this.anyPickupPending;
    }

    async updateGuildApplicationCommand(cmd: string, guild: Discord.Guild) {
        const guildSettings = this.getGuild(guild.id);
        const botCommand = this.getCommand(cmd);
        const guildApplicationCommand = guildSettings.applicationCommands?.get(cmd);

        if (guildApplicationCommand) {
            try {
                await guildApplicationCommand.edit(
                    {
                        ...guildApplicationCommand,
                        options: await botCommand.applicationCommand.getOptions(guild)
                    }
                )
            } catch (e) { }
        }
    }
}