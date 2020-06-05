import { Command } from '../core/types';
const command: Command = {
    cmd: 'test',
    shortDesc: 'Test cmd',
    desc: 'Test command',
    global: true,
    perms: false,
    exec: (params) => {
        console.log(`Hi from test, params: ${params}`);
    }
}

module.exports = command;