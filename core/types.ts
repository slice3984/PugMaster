import Discord from 'discord.js';
import Bot from './bot';

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

interface DefaultValue {
    type: 'string' | 'number';
    desc: string, value: string | number;
    possibleValues: number[] | string[] | { from: number; to: number }
}

export interface Command {
    cmd: string;
    aliases?: string[];
    shortDesc: string;
    desc: string;
    args?: CommandArgument[];
    perms: boolean;
    global: boolean;
    defaults?: DefaultValue[];
    exec: (bot: Bot, message: Discord.Message, params: any[], defaults?: any[]) => any;
}

export interface CommandArgument {
    name: string;
    desc: string;
    required: boolean;
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
    trustTime: number;
    disabledCommands: string[];
    commandSettings: Map<string, any[]>;
    channels: Map<bigint, ChannelType>;
}

export type ChannelType = 'pickup' | 'pickup-info' | 'listen';