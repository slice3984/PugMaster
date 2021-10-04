import { Command } from '../core/types';

const command: Command = {
    cmd: 'delete',
    category: 'admin',
    shortDesc: 'Multi-purpose command to remove map pools, pickups or servers',
    desc: 'Multi-purpose command to remove map pools, pickups or servers',
    args: [
        { name: '<mappool/pickup/server>', desc: 'Where to apply this command on', required: true },
        { name: '<toRemove>...', desc: 'List of items to remove', required: true }
    ],
    additionalInfo: 'Available shorthand replacements:\n'
        + 'mappool = mp, pickup = pu, server = sv',
    global: true,
    perms: true,
    exec: async (bot, message, params, defaults) => {

    }
}

module.exports = command;