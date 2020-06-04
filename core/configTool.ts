import fs from 'fs';
import { Config } from './types';

export default class ConfigTool {
    static configPath = process.env.DEV ? './config.json' : __dirname + '/config.json';
    static config: Config;

    static doesConfigExist(): Promise<Boolean> {
        console.log(this.configPath);
        return new Promise((res, _rej) => {
            fs.access(ConfigTool.configPath, fs.constants.F_OK, (err) => {
                if (err) {
                    res(false);
                } else {
                    const data = fs.readFileSync(ConfigTool.configPath).toString();
                    ConfigTool.config = JSON.parse(data);
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
    }
}`, 'utf8');
    }
}