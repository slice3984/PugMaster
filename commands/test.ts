import { Command } from '../core/types';
const command: Command = {
    cmd: 'test',
    shortDesc: 'Test cmd',
    desc: 'Test command',
    global: true,
    perms: false,
    exec: (bot, message, params) => {
        message.reply('test command executed');
    }
}

module.exports = command;