import Discord from "discord.js";
import inquirer from 'inquirer';
import inquirer_autocomplete from 'inquirer-autocomplete-prompt';
import Bot from "./core/bot";
import Logger from "./core/logger";
import Util from "./core/util";
import BotModel from "./models/bot";
import GuildModel from "./models/guild";
import PickupModel from "./models/pickup";

export default class Console {
    private guild: Discord.Guild;
    private pickupChannel: Discord.TextChannel;
    private bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
        this.showMenu();

        inquirer.registerPrompt('autocomplete', inquirer_autocomplete);
    }

    private async showMenu() {
        console.log('\nMain menu');
        const choice = await inquirer.prompt([
            {
                type: 'list',
                name: 'menu',
                message: 'Select option',
                choices: ['Guild options', 'Broadcast', 'Status']
            }
        ]);

        switch (choice.menu) {
            case 'Guild options':
                const answer: { guild: string } = await inquirer.prompt([
                    {
                        type: 'autocomplete',
                        name: 'guild',
                        message: 'Select guild: ',
                        pageSize: 5,
                        source: (_answers, input) => {
                            if (!input) {
                                return [];
                            }

                            const results = this.bot.getClient()
                                .guilds.cache
                                .filter(guild => guild.name.includes(input) || guild.id.includes(input))

                            return results.map(guild => `${guild.name} - ${guild.id}`);
                        },
                    }

                ]);

                this.guild = this.bot.getClient().guilds.cache.get(answer.guild.split(' ').pop());
                this.pickupChannel = await Util.getPickupChannel(this.guild);
                this.showGuildMenu();

                break;
            case 'Broadcast':
                const message = await inquirer.prompt([
                    {
                        type: 'input',
                        message: 'Message to broadcast: ',
                        name: 'message'
                    }
                ]);

                if (!message.message) {
                    console.log('Nothing broadcasted, no message provided');
                    return this.showMenu();
                }

                for (const guild of this.bot.getClient().guilds.cache.values()) {
                    const pickupChannel = await Util.getPickupChannel(guild);

                    if (pickupChannel) {
                        await pickupChannel.send(message.message);
                    }
                }

                console.log(`Broadcasted message: ${message.message}`);
                this.showMenu();
                break;
            case 'Status':
                const pendingAmount = await BotModel.getAmountOfPendingPickups();
                console.log(`Connected guilds: ${this.bot.getClient().guilds.cache.size}`);
                console.log(`Pending pickups: ${pendingAmount ? `${pendingAmount.guilds} guild(s) with ${pendingAmount.amount} pending pickup(s)` : '-'}`);
                this.showMenu();
                break;
            default:
                this.showMenu();
        }
    }

    private async showGuildMenu() {
        if (!this.isGuildAvailable()) {
            return;
        }

        console.log(`\nMenu for guild "${this.guild.name}" - ID: ${this.guild.id}`);
        const choice = await inquirer.prompt([
            {
                type: 'list',
                name: 'menu',
                message: 'Select option',
                choices: ['Clear state', 'Show active pickups', 'Send message', 'Ban guild', 'Home']
            }
        ]);

        if (!this.isGuildAvailable()) {
            return;
        }

        switch (choice.menu) {
            case 'Clear state':
                const confirmation = await inquirer.prompt([
                    {
                        type: 'confirm',
                        message: `Are you sure you want to reset the state for "${this.guild.name}" - ID: ${this.guild.id}? `,
                        name: 'confirm'
                    }
                ]);

                if (confirmation.confirm) {
                    await this.bot.getGuild(this.guild.id).resetState();
                    console.log('Cleared guild state');
                } else {
                    console.log('No guild state cleared')
                }

                this.showGuildMenu();
                break;
            case 'Show active pickups':
                const pickups = Array.from((await PickupModel.getActivePickups(BigInt(this.guild.id))).values())
                    .sort((a, b) => b.players.length - a.players.length);

                if (pickups.length === 0) {
                    console.log('No active pickups for this guild');
                } else {
                    const activePickups = [];
                    pickups.forEach(pickup => {
                        activePickups.push(`${pickup.name} - ${pickup.players.length} / ${pickup.maxPlayers}` +
                            `${pickup.maxPlayers === pickup.players.length ? ' - PENDING' : ''}`);
                    });
                    console.log(`Active pickups\n`, activePickups.join('\n'));
                }
                this.showGuildMenu();
                break;
            case 'Send message':
                const message = await inquirer.prompt([
                    {
                        type: 'input',
                        message: 'Message to send: ',
                        name: 'message'
                    }
                ]);

                if (!message.message) {
                    console.log('No message provided, no message send');
                } else {
                    if (this.pickupChannel) {
                        this.pickupChannel.send(message.message);
                    }

                    console.log(`Send message: ${message.message}`);
                }

                this.showGuildMenu();
                break;
            case 'Ban guild':
                const confirmationBan = await inquirer.prompt([
                    {
                        type: 'confirm',
                        message: `Are you sure you want ban guild "${this.guild.name}" - ID: ${this.guild.id}? `,
                        name: 'confirm'
                    }
                ]);

                if (confirmationBan.confirm) {
                    try {
                        await GuildModel.banGuild(BigInt(this.guild.id));
                        await this.bot.getGuild(this.guild.id).resetState();
                        await this.guild.leave();

                        console.log('Banned and left guild');
                    } catch (err) {
                        Logger.logError('Something went wrong banning a guild', err, true);
                    } finally {
                        this.showMenu();
                    }
                } else {
                    console.log('Didn\'t ban guild');
                    this.showGuildMenu();
                }
                break;
            case 'Home':
                this.showMenu();
                break;
        }
    }

    private isGuildAvailable(): boolean {
        if (this.guild) {
            return true;
        } else {
            console.log('Guild is not valid anymore, returning to main menu');
            this.showMenu();
            return false;
        }
    }
}