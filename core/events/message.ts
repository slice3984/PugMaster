import Discord from 'discord.js';
import Bot from '../bot';
import CommandHandler from '../commandHandler';
import PickupModel from '../../models/pickup';
import Util from '../util';

const commandHandler = new CommandHandler(Bot.getInstance());

module.exports = async (bot: Bot, message: Discord.Message) => {
    if (message.channel.type === 'dm' || message.member.user.bot) {
        return;
    }

    const guildPrefix = bot.getGuild(message.guild.id).prefix;
    let parts;
    let cmd;

    /*
    const settings = await PickupModel.getPickupSettings(BigInt(message.guild.id), 1);
    message.channel.send(await Util.parseStartMessage(BigInt(message.guild.id), message.content, settings,
        [BigInt('252538619787476993'), BigInt('252538619787476993')], [BigInt('252538619787476993'), BigInt('252538619787476993')]));
*/
    // Special commands: + / ++, - / -- & ??
    if (!message.content.startsWith(guildPrefix)) {
        if (!message.content.startsWith('+') ||
            !message.content.startsWith('-') ||
            !message.content.startsWith('??')) {
            parts = message.content.split(' ');
            cmd = parts.shift();
        } else {
            return;
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
    if (cmd.length > 1 && (cmd.startsWith('+') || cmd.startsWith('-')) &&
        (cmd.charAt(1) !== '+' && cmd.charAt(1) !== '-')) {
        const possiblePickup = cmd.substring(1);
        cmd = cmd.charAt(0);
        args.push(possiblePickup);
    }

    commandHandler.execute(message, cmd.toLocaleLowerCase(), args);
}