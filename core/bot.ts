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
        setInterval(async () => {
            // Expire check
            const dateInMs = new Date().getTime();
            const expires = await GuildModel.getAllExpires();
            const playersToRemove = new Map();

            expires.forEach(expire => {
                const timeLeft = expire.expiration_date.getTime() - dateInMs;
                if (timeLeft <= 0) {
                    if (playersToRemove.has(expire.guild_id)) {
                        playersToRemove.get(expire.guild_id).push(expire.player_id);
                    } else {
                        playersToRemove.set(expire.guild_id, [expire.player_id]);
                    }
                }
            });

            const genPickupInfo = pickup => `**${pickup.name}** [ **${pickup.players.length}** / **${pickup.maxPlayers}** ]`;

            for (const [guild, players] of playersToRemove.entries()) {
                await PickupModel.removePlayers(BigInt(guild), ...players);
                await PlayerModel.removeExpires(BigInt(guild), ...players);

                const guildObj = this.client.guilds.cache.get(guild);
                const pickupChannel = guildObj.channels.cache.get(await GuildModel.getPickupChannel(BigInt(guild))) as Discord.TextChannel;
                const playerObjs = players.map(player => guildObj.members.cache.get(player));

                pickupChannel.send(`${playerObjs.join(', ')} you got removed from all pickups, expire ran out`);

                const pickups = Array.from((await PickupModel.getActivePickups(BigInt(guild))).values())
                    .sort((a, b) => b.players.length - a.players.length);

                let msg = '';
                pickups.forEach(pickup => msg += `${genPickupInfo(pickup)} `);

                pickupChannel.send(msg || 'No active pickups');
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