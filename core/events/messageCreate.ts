import Discord from 'discord.js';
import Bot from '../bot';
import CommandHandler from '../commandHandler';
import { GuildMemberExtended } from '../types';

const commandHandler = CommandHandler.getInstance();

module.exports = async (bot: Bot, message: Discord.Message) => {
	if (message.channel.type === 'DM' || !message.member || message.member.user.bot) {
		return;
	}

	// Required to store this for the afk check since only the message cache gets cleared
	(message.member as GuildMemberExtended).lastMessageTimestamp =
		message.createdTimestamp;

	const guildPrefix = bot.getGuild(message.guild.id).prefix;
	let parts;
	let cmd;

	// Special commands: + / ++, - / -- & ??
	if (!message.content.startsWith(guildPrefix)) {
		if (
			!message.content.startsWith('+') &&
			!message.content.startsWith('-') &&
			!message.content.startsWith('??')
		) {
			return;
		} else {
			parts = message.content.split(' ');

			// Pickup has to be right next to +, -
			if (parts[0].length === 1) {
				return;
			}
			cmd = parts.shift();
		}
	} else {
		parts = message.content.split(' ');
		cmd = parts.shift().substr(guildPrefix.length);
	}

	let args = parts;

	if (args.length === 0 && (cmd === '+' || cmd === '-')) {
		return;
	}

	if (args.length === 0 && (cmd === '++' || cmd === '--')) {
		cmd = cmd.charAt(0);
	}

	// +/-pickupName
	if (
		cmd.length > 1 &&
		(cmd.startsWith('+') || cmd.startsWith('-')) &&
		cmd.charAt(1) !== '+' &&
		cmd.charAt(1) !== '-'
	) {
		const possiblePickup = cmd.substring(1);
		cmd = cmd.charAt(0);
		args.push(possiblePickup);
	}

	commandHandler.execute(message, cmd.toLocaleLowerCase(), args);
};
