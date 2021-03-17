import { InjectionKey } from 'vue';
import { Store } from 'vuex';

export interface RootState {
}

export interface HelpState {
    helpNavSections: HelpNavSection[]
}

export interface CommandState {
    commandCategories: CommandCategory[];
    commands: Map<string, CommandInfo>;
}

export interface StatsState {
    gotGuildBookmarks: boolean | null;
    bookmarkedGuilds: GuildBookmark[];
    storedGuilds: Map<String, {
        basicInfo: GuildBasicInfo,
        extendedInfo?: GuildInfoExtended
    }>
}

export interface GuildBookmark {
    id: String;
    name: String;
    icon: String
}

export interface GuildBasicInfo {
    id: String;
    name: String;
    icon: String;
}

export const rootKey: InjectionKey<Store<RootState>> = Symbol();

export interface CommandCategory {
    category: 'pickup' | 'info' | 'admin';
    commands: string[];
}

export interface HelpNavLink {
    id: String;
    title: String;
}

export interface HelpNavSection {
    name: String,
    links: HelpNavLink[]
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

export interface GuildInfoExtended {
    status: 'success' | 'fail';
    gotData: boolean;
    guildIcon?: string | null;
    guildName?: string;
    guildId?: string;
    memberCount?: number;
    pickupPlayerCount?: number;
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