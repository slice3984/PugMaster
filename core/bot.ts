import fs from 'fs';
import path from 'path';
import Discord from 'discord.js';
import ConfigTool from './configTool';
import { Command } from './types';

export default class Bot {
    private static instance: Bot;
    private commands: Map<string, Command> = new Map();
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
        console.log('Registering events');

        const register = async (dir = 'events') => {
            const files = await fs.promises.readdir(path.join(__dirname, dir));

            for (let file of files) {
                let stat = await fs.promises.lstat(path.join(__dirname, dir, file));
                if (stat.isDirectory()) {
                    register(path.join(dir, file));
                } else {
                    let eventName = file.substring(0, file.length - 3);
                    const module: Function = require(path.join(__dirname, dir, file));
                    // @ts-ignore - Required for dynamic event registration
                    this.client.on(eventName, module.bind(null, this));
                }
            }
        };

        register();
    }

    private async registerCommands() {
        console.log('Registering commands');

        const register = async (dir = 'commands') => {
            const files = await fs.promises.readdir(path.join(__dirname, '/../', dir));

            for (let file of files) {
                let stat = await fs.promises.lstat(path.join(__dirname, '/../', dir, file));
                if (stat.isDirectory()) {
                    register(path.join(dir, file));
                } else {
                    const module: Command = require(path.join(__dirname, '/../', dir, file));
                    this.commands.set(module.cmd, module);
                }
            }
        };

        register();
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
}