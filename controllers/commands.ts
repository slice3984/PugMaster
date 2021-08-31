import express from 'express';
import Bot from '../core/bot';

export default ((req: express.Request, res: express.Response) => {
    const bot = Bot.getInstance();

    const categories = [
        { category: 'pickup', commands: [] },
        { category: 'info', commands: [] },
        { category: 'admin', commands: [] }
    ];

    const commandList = bot.getCommandNames()
        .filter(cmd => cmd !== 'test');

    commandList.forEach(commandName => {
        const command = bot.getCommand(commandName);
        categories.find(cat => cat.category === command.category).commands.push(command.cmd);
    });

    res.json({
        categories
    })
});