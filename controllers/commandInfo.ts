import express from 'express';
import Bot from '../core/bot';
import { CommandInfo } from '../core/types';

export default ((req: express.Request, res: express.Response) => {
    const commandName = req.body.command;
    const bot = Bot.getInstance();

    if (!commandName) {
        return res.json({
            code: 400,
            status: 'no command provided'
        });
    }

    const command = bot.getCommand(commandName);

    if (!command) {
        return res.json({
            code: 404,
            status: 'command not found'
        });
    }

    const info: CommandInfo = {
        cmd: command.cmd,
        cooldown: command.cooldown || null,
        category: command.category,
        aliases: command.aliases || null,
        desc: command.desc,
        args: command.args || null,
        perms: command.perms,
        global: command.global,
        defaults: command.defaults || null
    }

    res.json(info);
});