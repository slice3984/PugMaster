import { Command } from '../core/types';
import Util from '../core/util';
import { Validator } from '../core/validator';

const command: Command = {
    cmd: 'modify_command',
    category: 'admin',
    aliases: ['modify_cmd'],
    shortDesc: 'Disable/enable or modify commands',
    desc: 'Disable/enable or modify commands',
    args: [
        { name: '<command>', desc: 'The command to disable/enable or modify', required: true },
        { name: '<operation>', desc: 'Operation on the command, can be show, enable, disable or the property', required: true },
        { name: '[value]', desc: 'The new value of the default', required: false }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        let passedName = params[0].toLowerCase();
        const operation = params[1].toLowerCase();

        if (!bot.doesCommandExist(passedName)) {
            Util.send(message, 'error', `unknown command **${passedName}**`);
        }

        const guildSettings = bot.getGuild(message.guild.id);
        const command = bot.getCommand(passedName);

        if (params.length === 2) {
            if (!['show', 'enable', 'disable'].includes(operation)) {
                return Util.send(message, 'error', 'unknown operation do you mean **show**, **enable** or **disable**?');
            }

            if (operation === 'disable') {
                if (['modify_command', 'permission', 'pickup'].includes(command.cmd)) {
                    return Util.send(message, 'error', `Command **${command.cmd}** can't be disabled`, false);
                }

                if (guildSettings.disabledCommands.includes(command.cmd)) {
                    return Util.send(message, 'error', `Command **${command.cmd}** is already disabled`, false);
                }

                if (command.applicationCommand) {
                    const applicationCommand = guildSettings.applicationCommands.get(command.cmd);

                    if (applicationCommand) {
                        try {
                            await applicationCommand.delete();
                            guildSettings.applicationCommands.delete(command.cmd);
                        } catch (_) {
                            await Util.send(message, 'error', `Unable to remove slash command for **${command.cmd}**, permissions missing?`, false);
                        }
                    }
                }


                guildSettings.disableCommand(command.cmd);
                return Util.send(message, 'success', `Disabled command **${command.cmd}**`, false);
            }

            if (operation === 'enable') {
                if (!guildSettings.disabledCommands.includes(command.cmd)) {
                    return Util.send(message, 'info', `Command **${command.cmd}** is not disabled`, false);
                }

                guildSettings.enableCommand(command.cmd);

                // application command
                if (command.applicationCommand) {
                    if (!command.applicationCommand.global) {
                        try {
                            guildSettings.applicationCommands.set(command.cmd, await message.guild.commands.create({
                                name: command.cmd,
                                description: command.shortDesc,
                                options: await command.applicationCommand.getOptions(message.guild)
                            }));

                        } catch (_) {
                            await Util.send(message, 'error', `Unable to register slash command for **${command.cmd}**, permissions missing?`, false);
                        }
                    }
                }

                return message.channel.send(Util.formatMessage('success', `Enabled command **${command.cmd}**`));
            }

            if (operation === 'show') {
                if (command.defaults) {
                    let info;

                    if (guildSettings.commandSettings.has(command.cmd)) {
                        const settings = guildSettings.commandSettings.get(command.cmd);
                        info = settings.map((value, index) => {
                            // Get the default type
                            const type = bot.getCommand(command.cmd).defaults[index].type;
                            const val = type === 'time' ? Util.formatTime(+value) : value;

                            return `${command.defaults[index].name}: ${val}`;
                        }).join('\n');
                    } else {
                        info = command.defaults.map(def => {
                            const type = def.type;
                            const value = type === 'time' ? Util.formatTime(+def.value) : def.value;

                            return `${def.name}: ${value}\n`;
                        });
                    }

                    Util.send(message, 'none', `Settings of command **${command.cmd}**\n${info}`, false);

                } else {
                    Util.send(message, 'info', `Command **${command.cmd}** got no settings`, false);
                }
            }
        } else {
            let value: string | number = params.slice(2).join(' ');

            if (command.defaults) {
                const defaultvalue = command.defaults.find(def => def.name === operation);

                if (!defaultvalue) {
                    return Util.send(message, 'error', `unknown property, did you mean ${command.defaults.map(def => `**${def.name}**`).join(', ')}?`);
                }

                const type = defaultvalue.type;
                const isInvalid = Validator.CommandOption.validate(guildSettings, { command, key: operation, value });

                if (isInvalid.length) {
                    return Util.send(message, 'error', isInvalid[0].errorMessage, false);
                }

                if (type === 'time') {
                    value = Util.timeStringToTime(value) * 60 * 1000;
                }

                let currentSettings;

                if (guildSettings.commandSettings.has(command.cmd)) {
                    currentSettings = guildSettings.commandSettings.get(command.cmd);
                } else {
                    currentSettings = command.defaults.map(def => def.value);
                }

                const index = command.defaults.findIndex(def => def.name === operation);
                const isNumeric = command.defaults[index].type === 'number';

                if (currentSettings[index].toString() === value) {
                    return Util.send(message, 'error', `Property **${operation}** of command **${command.cmd}** is already set to this value`, false);
                }

                currentSettings[index] = isNumeric ? +value : value;

                await guildSettings.modifyCommand(command, currentSettings);

                // In case of expire command, update
                if (command.cmd === 'expire') {
                    await bot.updateGuildApplicationCommand('expire', message.guild);
                }

                Util.send(message, 'success', `Modified command **${command.cmd}**, set **${operation}** to ${type === 'time' ? `**${Util.formatTime(+value)}**` : `**${value}**`}`, false);
            } else {
                Util.send(message, 'error', 'This command got no configurable settings');
            }
        }
    }
}

module.exports = command;