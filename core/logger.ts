import fs from 'fs';

export default class Logger {
    static errorFilePath = './error.log';

    public static async logError(message: string, error: Error | any, logToConsole: boolean, guildId?: string, guildName?: string) {
        const dateObj = new Date().toLocaleDateString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "numeric",
            hour: '2-digit',
            minute: '2-digit',
            second: 'numeric'
        });

        if (logToConsole) {
            console.error(`ERROR - ${dateObj}: ${message}`);
        }

        let errorMsg = `[${dateObj}]${guildId ? `[${guildId}${guildName ? ` / ${guildName}` : ''}]` : ''} ${message}`;

        if (error instanceof Error) {
            if (error.stack) {
                errorMsg += `\n${error.stack}`;
            } else {
                errorMsg += `\nError: ${error.name} - ${error.message}`;
            }
        }

        errorMsg += '\n---\n';
        await fs.promises.appendFile(this.errorFilePath, errorMsg);
    }
}