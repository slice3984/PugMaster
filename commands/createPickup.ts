import { Command } from '../core/types';
import Util from '../core/util';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'create_pickups',
    cooldown: 10,
    category: 'admin',
    shortDesc: 'Creates one or multiple pickups',
    desc: 'Creates one or multiple pickups',
    args: [
        { name: '<name:players:teams>', desc: 'PickupName:PlayerCount and teams amount as optional argument', required: true }
    ],
    global: true,
    perms: true,
    exec: async (bot, message, params) => {
        let validPickups = [];
        for (const pickup of params) {
            const parts = pickup.split(':').filter(part => !(part === ''));

            if (parts.length < 2) {
                continue;
            } else {
                if (!/^[a-zA-Z0-9]+$/.test(parts[0])) {
                    continue;
                }

                if (/^\d+$/.test(parts[0]) || parts[0].length > 20) {
                    continue;
                }

                if (!Number.isInteger(+parts[1]) || +parts[1] < 2 || +parts[1] > 100) {
                    continue;
                }

                if (parts.length >= 3) {
                    if (!Number.isInteger(+parts[2]) || +parts[1] % +parts[2] !== 0) {
                        continue;
                    }
                } else {
                    if (+parts[1] % 2 !== 0) {
                        continue;
                    }
                }
                validPickups.push({ name: parts[0], playerCount: +parts[1], teamCount: parts[2] || 2 });
            }
        }

        if (validPickups.length === 0) {
            return Util.send(message, 'error', 'invalid syntax, no pickups created');
        }

        let alreadyStored = await PickupModel.areValidPickups(BigInt(message.guild.id), false, ...validPickups
            .map(pickup => pickup.name));

        const alreadyStoredNames = alreadyStored.map(pickup => pickup.name);

        validPickups = validPickups.filter(pickup => !alreadyStoredNames.includes(pickup.name));

        if (validPickups.length === 0) {
            return Util.send(message, 'error', 'valid given pickups are already stored');
        }

        const pickups = await PickupModel.getAllPickups(BigInt(message.guild.id), true);

        const exceededBy = (pickups.length + validPickups.length) - 50;

        if (exceededBy > 0) {
            return Util.send(message, 'error', `Exceeding the maximum stored pickup capacity of **50** by **${exceededBy}**, remove pickups to create more`, false);
        }

        const exceededByActive = (pickups.filter(p => p.enabled).length + validPickups.length) - 20;

        if (exceededByActive > 0) {
            return Util.send(message, 'error', `Exceeding the maximum capacity of enabled pickups of **20** by **${exceededByActive}**, disable pickups to create more`, false);
        }

        await PickupModel.createPickups(BigInt(message.guild.id), ...validPickups);

        // Update application commands
        await bot.updatePickupDependentApplicationCommands(message.guild);

        Util.send(message, 'success', `Created **${validPickups.length}** pickup${validPickups.length > 1 ? 's' : ''} (${validPickups.map(pickup => `**${pickup.name}**`).join(', ')})`, false);
    }
};

module.exports = command;