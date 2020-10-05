import fs from 'fs';
import { Config } from './types';

export default class ConfigTool {
    static configPath = './config.json';
    static config: Config;

    static doesConfigExist(): Promise<Boolean> {
        return new Promise((res, _rej) => {
            fs.access(ConfigTool.configPath, fs.constants.F_OK, (err) => {
                if (err) {
                    res(false);
                } else {
                    res(true);
                }
            });
        })
    }

    static generateConfig() {
        return fs.promises.writeFile(ConfigTool.configPath,
            `{
    "bot": {
        "token": ""
    },
    "db": {
        "server": "",
        "user": "",
        "password": "",
        "db": ""
    },
    "settings": {
        "MAX_GLOBAL_EXPIRE": "86400000",
        "MAX_WARN_STREAKS": "10",
        "MAX_WARN_STREAK_EXPIRATION_TIME": "2592000000",
        "MAX_WARN_EXPIRATION_TIME": "1209600000",
        "MAX_WARN_BANTIME": "604800000",
        "MAX_WARN_BANTIME_MULTIPLIER": "5" 
    },
    "webserver": {
        "port": "1337",
        "domain": "example.com"
    }
}`, 'utf8');
    }

    static getConfig(): Config {
        if (!ConfigTool.config) {
            const data = fs.readFileSync(ConfigTool.configPath).toString();
            ConfigTool.config = JSON.parse(data);
        }
        return ConfigTool.config;
    }
}