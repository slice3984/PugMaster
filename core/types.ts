export interface Config {
    bot: {
        token: string
    };
    db: {
        server: string;
        user: string;
        password: string;
        db: string;
    }
};

export interface Command {
    cmd: string;
    aliases?: string[];
    shortDesc: string;
    desc: string;
    args?: string[][];
    perms: boolean;
    global: boolean;
    defaults?: any[];
    defaultDescs?: string[];
    exec: (params: any[], defaults?: any[]) => any;
}