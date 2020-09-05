import express from 'express';
import Bot from '../../core/bot';

const bot = Bot.getInstance();

export default (req: express.Request, res: express.Response) => {
    const commands = bot.getCommandNames();

    const pickup = [];
    const info = [];
    const admin = [];

    commands.forEach(commandName => {
        const command = bot.getCommand(commandName);

        switch (command.category) {
            case 'pickup':
                pickup.push(command);
                break;
            case 'info':
                info.push(command);
                break;
            case 'admin':
                admin.push(command);
        }
    });


    res.render('homepage/commands', { liveReload: process.env.DEBUG, commands: [pickup, info, admin] });
}