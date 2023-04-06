import Discord from 'discord.js';
import Bot from './bot';
import PermissionModel from '../models/permission';
import Logger from './logger';
import { Config } from './types';
import ConfigTool from './configTool';
import Util from './util';
import GuildSettings from './guildSettings';

export default class CommandHandler {
	private static instance: CommandHandler;
	private bot: Bot;
	private config: Config;

	private constructor() {
		this.bot = Bot.getInstance();
		this.config = ConfigTool.getConfig();
	}

	static getInstance(): CommandHandler {
		if (!CommandHandler.instance) {
			CommandHandler.instance = new CommandHandler();
		}

		return this.instance;
	}

	private async gotPermission(
		member: Discord.GuildMember,
		cmd,
		subCommand: string = null
	) {
		// Admin
		if (member.permissions.has([Discord.Permissions.FLAGS.ADMINISTRATOR])) {
			return true;
		}

		const userRoleIds = member.roles.cache.map((strId) => BigInt(strId.id));

		if (userRoleIds.length > 0) {
			// Check if one of the user roles got the required permission
			const command = subCommand ? `${cmd}/${subCommand}` : cmd;
			return await PermissionModel.guildRolesGotCommandPermission(
				BigInt(member.guild.id),
				command,
				...userRoleIds
			);
		}

		return false;
	}

	private isCommandAvailable(
		input: Discord.Message | Discord.CommandInteraction,
		cmd: string
	) {
		const guild = this.bot.getGuild(input.guild.id);

		// Check if its a valid command
		const isValid = this.bot.doesCommandExist(cmd);

		if (!isValid) {
			return false;
		}

		cmd = this.bot.getCommand(cmd).cmd;

		// Test command is only executable by bot owners
		if (cmd === 'test') {
			let authorId;

			if (input instanceof Discord.Message) {
				authorId = input.author.id;
			} else {
				authorId = input.member.user.id;
			}

			return this.config.bot.owner_id === authorId;
		}

		// Check if guild disabled
		const isDisabled = guild.disabledCommands.includes(cmd);

		if (isDisabled) {
			return false;
		}

		// Make sure its the correct channel, only allow setup commands everywhere
		if (cmd === 'pickup') {
			return true;
		}
		if (guild.channels.has(BigInt(input.channel.id))) {
			if (this.bot.getCommand(cmd).global) {
				return true;
			} else if (guild.channels.get(BigInt(input.channel.id)) === 'pickup') {
				return true;
			} else {
				return false;
			}
		}

		return false;
	}

	private handleGuildCommandCooldown(
		input: Discord.Message | Discord.CommandInteraction,
		cmd: string,
		guildSettings: GuildSettings
	): boolean {
		const messageTimestamp = input.createdTimestamp;
		const command = this.bot.getCommand(cmd);
		const cmdCooldownTime = command.cooldown * 1000; // Given in seconds
		const cooldownTimes = guildSettings.commandCooldowns;
		const commandTime = cooldownTimes.get(command.cmd);

		if (commandTime) {
			if (commandTime + cmdCooldownTime > messageTimestamp) {
				const timeLeft = commandTime + cmdCooldownTime - messageTimestamp;

				if (input instanceof Discord.CommandInteraction) {
					input.reply({
						content:
							'You can execute this command again in **${Util.formatTime(timeLeft)}**',
						ephemeral: true,
					});
				} else {
					input.channel.send(
						Util.formatMessage(
							'info',
							`${
								input.author
							}, you can execute this command again in **${Util.formatTime(
								timeLeft
							)}**`
						)
					);
				}
				return false;
			}
		}
		cooldownTimes.set(command.cmd, messageTimestamp);

		return true;
	}

	private handleFloodProtection(
		input: Discord.Message | Discord.CommandInteraction,
		command: string,
		guildSettings: GuildSettings
	): boolean {
		const floodDelay = +this.config.settings.FLOOD_PROTECTION_DELAY;
		const floodMaxCommands = +this.config.settings.FLOOD_PROTECTION_MAX_COMMANDS;
		const floodTimeout = +this.config.settings.FLOOD_TIMEOUT_TIME;

		const commandExecutionsTimes = guildSettings.lastCommandExecutions;

		let memberId;

		if (input instanceof Discord.CommandInteraction) {
			memberId = (input.member as Discord.GuildMember).id;
		} else {
			memberId = input.member.id;
		}

		const lastUserCommandTimes = commandExecutionsTimes.get(memberId);
		const messageTimestamp = input.createdTimestamp;

		if (messageTimestamp) {
			if (!lastUserCommandTimes) {
				commandExecutionsTimes.set(memberId, {
					count: 1,
					timestamp: messageTimestamp,
				});
				return true;
			} else {
				// If the message count already reached the max count, trigger flood protection without message
				if (lastUserCommandTimes.count >= floodMaxCommands) {
					// Check if a flood reset is required
					if (
						lastUserCommandTimes.timestamp + floodTimeout <
						messageTimestamp
					) {
						lastUserCommandTimes.count = 1;
						lastUserCommandTimes.timestamp = messageTimestamp;
						return true;
					}

					return false;
				}

				// Reset the counter if last message is longer ago than flood timeout
				if (lastUserCommandTimes.timestamp + floodTimeout < messageTimestamp) {
					lastUserCommandTimes.count = 1;
				}

				// Add to count if the message triggers the protection
				if (lastUserCommandTimes.timestamp + floodDelay > messageTimestamp) {
					lastUserCommandTimes.count++;
					lastUserCommandTimes.timestamp = messageTimestamp;
				}

				if (lastUserCommandTimes.count < floodMaxCommands) {
					lastUserCommandTimes.timestamp = messageTimestamp;

					return true;
				}

				// Don't display any message in case of the pickup command to avoid output in non bot managed channels
				if (command === 'pickup') {
					return false;
				}

				if (input instanceof Discord.CommandInteraction) {
					input.reply({
						content: `Too quick, you got timed out for **${Util.formatTime(
							floodTimeout
						)}**`,
						ephemeral: true,
					});
				} else {
					input.channel.send(
						Util.formatMessage(
							'error',
							`${
								input.author
							}, too quick, you got timed out for **${Util.formatTime(
								floodTimeout
							)}**`
						)
					);
				}
				return false;
			}
		}
	}

	async execute(
		input: Discord.Message | Discord.CommandInteraction,
		cmd: string,
		args: any[] = []
	) {
		const guildSettings = this.bot.getGuild(input.guild.id);

		const errorHandler = (err) => {
			// Insufficient permissions, in this case to send messages
			if (err.code === 50013) {
				// Nothing to do, ignore the exception
				return;
			}
			input.channel.send(
				Util.formatMessage('error', 'Something went wrong executing this command')
			);

			if (input instanceof Discord.CommandInteraction) {
				Logger.logError(
					`Error in executing '${cmd}' system command, args: ${
						args.length ? args.join(', ') : '-'
					}`,
					err,
					false,
					input.guild.id,
					input.guild.name
				);
			} else {
				Logger.logError(
					`Error in executing '${cmd}' command, args: ${
						args.length ? args.join(', ') : '-'
					}`,
					err,
					false,
					input.guild.id,
					input.guild.name
				);
			}
		};

		if (!this.isCommandAvailable(input, cmd)) {
			return;
		}

		if (!this.handleFloodProtection(input, cmd, guildSettings)) {
			return;
		}

		const guild = this.bot.getGuild(input.guild.id);
		const command = this.bot.getCommand(cmd);

		let member;
		if (input instanceof Discord.CommandInteraction) {
			member = input.member as Discord.GuildMember;
		} else {
			member = input.member;
		}

		const commandObj = this.bot.getCommand(cmd);
		let subCommand;

		// Create, edit and delete commands come with sub permissions
		if (['create', 'edit', 'delete'].includes(commandObj.cmd) && args.length) {
			subCommand = args[0].toLowerCase();
		}

		if (
			command.perms &&
			!(await this.gotPermission(member, commandObj.cmd, subCommand))
		) {
			if (cmd === 'pickup') {
				// Don't display any message in case of the pickup command to avoid output in non bot managed channels
				return;
			}

			if (input instanceof Discord.CommandInteraction) {
				return input.reply('insufficient permissions to execute this command');
			} else {
				return input.channel.send(
					Util.formatMessage(
						'error',
						`${input.author}, insufficient permissions to execute this command`
					)
				);
			}
		}

		// Test if required args are given
		const requiredArgs = command.args
			? command.args.filter((arg) => arg.required).length
			: 0;

		if (input instanceof Discord.Message) {
			if (requiredArgs > args.length) {
				let reply = `${input.author}, arguments are missing, usage: ${guild.prefix}${command.cmd} `;
				command.args.forEach((arg) => (reply += `**${arg.name}** `));
				return input.channel.send(Util.formatMessage('info', reply));
			}
		}

		if (!this.handleGuildCommandCooldown(input, cmd, guildSettings)) {
			return;
		}

		if (guild.commandSettings.has(command.cmd)) {
			try {
				if (input instanceof Discord.CommandInteraction) {
					await command.exec(
						this.bot,
						null,
						args,
						guild.commandSettings.get(command.cmd),
						input
					);
				} else {
					await command.exec(
						this.bot,
						input,
						args,
						guild.commandSettings.get(command.cmd)
					);
				}
			} catch (err) {
				errorHandler(err);
			}
		} else {
			const defaults = command.defaults
				? command.defaults.map((def) => def.value)
				: null;

			if (defaults) {
				try {
					if (input instanceof Discord.CommandInteraction) {
						await command.exec(this.bot, null, args, defaults, input);
					} else {
						await command.exec(this.bot, input, args, defaults);
					}
				} catch (err) {
					errorHandler(err);
				}
			} else {
				try {
					if (input instanceof Discord.CommandInteraction) {
						await command.exec(this.bot, null, args, [], input);
					} else {
						await command.exec(this.bot, input, args);
					}
				} catch (err) {
					errorHandler(err);
				}
			}
		}
	}
}
