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
    };
    settings: {
        MAX_GLOBAL_EXPIRE: string;
        MAX_WARN_STREAKS: string;
        MAX_WARN_STREAK_EXPIRATION_TIME: string;
        MAX_WARN_EXPIRATION_TIME: string;
        MAX_WARN_BANTIME: string;
        MAX_WARN_BANTIME_MULTIPLIER: string;
    };
    webserver: {
        port: string;
    }
};

interface DefaultValue {
    type: 'string' | 'number';
    name: string;
    desc: string;
    value: string | number;
    possibleValues: number[] | string[] | { from: number; to: number };
}

export interface Command {
    cmd: string;
    category: 'pickup' | 'info' | 'admin';
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

export type ChannelType = 'pickup' | 'pickup-info' | 'listen';

export interface ValidationError {
    type: string;
    errorMessage: string;
}

export type TimeError = 'exceeded' | 'subceeded' | 'invalid';

export interface PickupSettings {
    id: number;
    name: string;
    playerCount: number;
    teamCount: number;
    isDefaultPickup: boolean;
    mapPoolId: number | null;
    afkCheck: boolean;
    pickMode: 'no_teams' | 'manual' | 'elo';
    whitelistRole: bigint | null;
    blacklistRole: bigint | null;
    promotionRole: bigint | null;
    captainRole: bigint | null;
    serverId: number | null;
}

export interface PickupInfo {
    id: number;
    name: string;
    startedAt: Date;
    playerNicks: String[];
}

export interface PlayerNicks {
    oldNick: boolean;
    players: { oldNick?: string; currentNick: string; id: number; userId: BigInt }[]
}

export interface PendingPickup {
    pickupConfigId: number;
    name: string;
    maxPlayers: number;
    amountPlayersAdded: number; // Required in case of player removes / auto removes
    pendingSince: Date;
    currentIteration: number;
    stage: 'afk_check' | 'picking_manual';
    teams: [
        {
            name: string,
            players: [
                {
                    id: bigint, nick: string
                }
            ]
        }
    ];
    playersLeft: [{ id: bigint, nick: string }] // Only required for manual picking
}

export interface GuildInfo {
    status: 'success' | 'fail';
    gotData: boolean;
    guildIcon?: string | null;
    guildName?: string;
    guildId?: string;
    memberCount?: number;
    pickupPlayerCount?: number; // Players who are stored and played at least one pickup
    pickupCount?: number;
    lastGame?: { name: string; date: Date };
    pickupsChartData?: {
        name: string;
        amount: number;
    }[];
    topPlayersChartData?: {
        nick: string;
        amount: number;
    }[];
    activityTimesChartData?: Date[];
}

export interface PickupInfoAPI {
    foundPickup: boolean;
    id: number;
    isRated: boolean;
    winnerTeam: string | null;
    teams: {
        name: string;
        players: {
            id: string;
            elo: number;
            nick: string;
        }[]
    }
}

export interface PlayerSearchResult {
    id: string;
    currentNick: string;
    knownAs: string | null;
    elo: number | null;
}