import Discord from 'discord.js';
import { Rating } from 'ts-trueskill';
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
        FLOOD_PROTECTION_DELAY: string;
        FLOOD_PROTECTION_MAX_COMMANDS: string;
        FLOOD_TIMEOUT_TIME: string;
    };
    emojis: {
        success: string;
        info: string;
        warn: string;
        error: string;
        unranked: string;
        rank_1: string;
        rank_2: string;
        rank_3: string;
        rank_4: string;
        rank_5: string;
        rank_6: string;
        rank_7: string;
        rank_8: string;
        rank_9: string;
        rank_10: string;
        rank_11: string;
        rank_12: string;
        rank_13: string;
        rank_14: string;
        rank_15: string;
        lb_leader: string;
    };
    webserver: {
        port: string;
        domain: string;
    };
};

interface DefaultValue {
    type: 'string' | 'number' | 'time';
    name: string;
    desc: string;
    value: string | number;
    possibleValues: number[] | string[] | { from: number; to: number };
}

export interface Command {
    cmd: string;
    cooldown?: number;
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
    mapvote: boolean;
    afkCheck: boolean;
    captainSelection: 'manual' | 'auto',
    pickMode: 'no_teams' | 'manual' | 'random' | 'elo' | 'autopick';
    rated: boolean;
    maxRankRatingCap: number;
    whitelistRole: string | null;
    blacklistRole: string | null;
    promotionRole: string | null;
    captainRole: string | null;
    serverId: number | null;
}

export interface PickupInfo {
    id: number;
    name: string;
    startedAt: Date;
    isRated: boolean;
    teams: {
        name: string;
        outcome: 'win' | 'draw' | 'loss' | null;
        players: {
            nick: string;
            id: string;
            rating: Rating,
            isCaptain: boolean
        }[]
    }[]
}

export interface PlayerNicks {
    oldNick: boolean;
    players: { oldNick?: string; currentNick: string; id: number; userId: string }[]
}

export interface PendingPickup {
    pickupConfigId: number;
    name: string;
    maxPlayers: number;
    amountPlayersAdded: number; // Required in case of player removes / auto removes
    pendingSince: Date;
    currentIteration: number;
    stage: 'afk_check' | 'picking_manual' | 'mapvote' | 'captain_selection';
    teams: [
        {
            name: string,
            players: [
                {
                    id: string, nick: string, isCaptain: boolean, captainTurn: boolean, rating: Rating
                }
            ]
        }
    ];
    playersLeft: [{ id: string, nick: string, isCaptain: boolean, captainTurn: boolean, rating: Rating }] // Only required for manual picking
}

export interface ActivePickup {
    name: string,
    players: {
        id: string | null,
        nick: string, rating: Rating | null
    }[];
    maxPlayers: number;
    teams: number;
    configId: number
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
    topPlayersRatingsChartData?: {
        pickup: string;
        players:
        {
            nick: string;
            rating: number;
            variance: number
        }[]
    }[];
    activityTimesChartData?: Date[];
}

export interface PickupInfoAPI {
    foundPickup: boolean;
    id: number;
    isRated: boolean;
    map: String;
    teams: {
        name: string;
        outcome: 'win' | 'draw' | 'loss' | null,
        players: {
            id: string;
            nick: string;
        }[]
    }[]
}

export interface CommandInfo {
    cmd: string;
    cooldown?: number;
    category: 'pickup' | 'info' | 'admin';
    aliases?: string[];
    desc: string;
    args?: {
        name: string;
        desc: string;
        required: boolean;
    }[];
    perms: boolean;
    global: boolean;
    defaults?: {
        type: 'string' | 'number' | 'time';
        name: string;
        desc: string;
        value: string | number;
        possibleValues: number[] | string[] | { from: number; to: number };
    }[]
}

export interface RateablePickup {
    pickupId: number;
    pickupConfigId: number;
    name: string;
    startedAt: Date;
    isRated: boolean;
    captains: { team: string; id: string; rating: number; nick: string }[]; // Can be empty if the team got autopicked
    teams: {
        name: string;
        outcome: 'win' | 'draw' | 'loss' | null,
        players: {
            id: string;
            rating: number;
            nick: string;
        }[]
    }[]
}

export interface PlayerSearchResult {
    id: string;
    currentNick: string;
    knownAs: string | null;
}

export interface GuildMemberExtended extends Discord.GuildMember {
    lastMessageTimestamp: number;
}

export interface RatingTeam {
    team: string,
    outcome: 'win' | 'loss' | 'draw',
    players: { id: string, rating: Rating }[]
}

export interface RatingPickup {
    pickupId: number;
    teams: RatingTeam[]
}

export interface PickupStartConfiguration {
    guild: Discord.Guild,
    pickupConfigId: number,
    teams?: bigint[] | bigint[][];
    map?: string;
    captains?: bigint[];
    drawProbability?: number;
}

export type PickupStageType = 'no_teams' | 'manual' | 'random' | 'elo' | 'autopick';