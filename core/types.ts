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

// Only storing frequently accessed data
export interface GuildSettings {
    id: bigint;
    prefix: string;
    promotionRole: bigint;
    blacklistRole: bigint;
    whitelistRole: bigint;
    lastPromote: Date | null;
    globalExpireTime: number;
    disabledCommands?: string[];
    commandSettings?: Map<string, any[]>;
}