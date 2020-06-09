import fs from 'fs';
import path from 'path';
import Discord from 'discord.js';
import ConfigTool from './configTool';
import { Command, GuildSettings } from './types';
import GuildModel from '../models/guild';
import BotModel from '../models/bot';

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

        // Loading Events & Commands
        await this.registerEventListeners();
        await this.registerCommands();
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

    loadConnectedGuildsSettings() {
        this.client.guilds.cache.forEach(async guild => {
            const data = await GuildModel.getGuildSettings(BigInt(guild.id));
            this.guilds.set(BigInt(guild.id), data);
        });
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