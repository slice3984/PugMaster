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
    webserver: {
        port: string;
        domain: string;
    }
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
    afkCheck: boolean;
    pickMode: 'no_teams' | 'manual' | 'random' | 'elo' | 'autopick';
    rated: boolean;
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
    teams: { name: string; outcome: 'win' | 'draw' | 'loss' | null; players: { nick: string; isCaptain: boolean }[] }[]
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
    stage: 'afk_check' | 'picking_manual';
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
        nick: string;
        amount: number;
    }[];
    activityTimesChartData?: Date[];
}

export interface PickupInfoAPI {
    foundPickup: boolean;
    id: number;
    isRated: boolean;
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
    rating: number | null;
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
    captains?: bigint[];
    drawProbability?: number;
}