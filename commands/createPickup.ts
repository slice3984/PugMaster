import { Command } from '../core/types';
import PickupModel from '../models/pickup';

const command: Command = {
    cmd: 'create_pickups',
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
            return message.reply('Invalid syntax, no pickups created');
        }

        const alreadyStored = await PickupModel.areValidPickups(BigInt(message.guild.id), ...validPickups
            .map(pickup => pickup.name));

        validPickups = validPickups.filter(pickup => !alreadyStored.includes(pickup.name));

        if (validPickups.length === 0) {
            return message.reply('Valid given pickups are already stored');
        }

        await PickupModel.createPickups(BigInt(message.guild.id), ...validPickups);
        message.reply(`Successfully created ${validPickups.length} pickup${validPickups.length > 1 ? 's' : ''} (${validPickups.map(pickup => pickup.name).join(', ')})`);
    }
};

module.exports = command;