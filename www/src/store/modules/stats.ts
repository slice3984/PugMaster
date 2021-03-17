import { Module } from 'vuex';
import postApi from '../postApi';
import { GuildBasicInfo, GuildBookmark, GuildInfoExtended, RootState, StatsState } from '../types';

export const statsModule: Module<StatsState, RootState> = {
    namespaced: true,
    state: {
        gotGuildBookmarks: null,
        bookmarkedGuilds: [],
        storedGuilds: new Map()
    },
    getters: {
        getBookmarkedGuilds(state): GuildBookmark[] {
            return state.bookmarkedGuilds;
        },
        gotBookmarkedGuilds(state): boolean | null {
            return state.gotGuildBookmarks;
        },
        getBasicGuildInfo: (state) => (guildId): GuildBasicInfo => {
            const guild = state.storedGuilds.get(guildId);
            return guild ? guild.basicInfo : null;
        },
        getExtendedGuildInfo: state => (guildId): GuildInfoExtended => {
            const guild = state.storedGuilds.get(guildId);

            if (guild) {
                return guild.extendedInfo ? guild.extendedInfo : null;
            } else {
                return null;
            }
        }
    },
    mutations: {
        SET_GUILD_BOOKMARKS(state, payload) {
            state.bookmarkedGuilds = payload;
        },
        SET_GOT_BOOKMARKS_STORED(state, payload) {
            state.gotGuildBookmarks = payload;
        },
        SET_BASIC_GUILD_INFO(state, payload) {
            const guild = state.storedGuilds.get(payload.id);

            if (guild) {
                guild.basicInfo = payload;
            } else {
                state.storedGuilds.set(payload.id, { basicInfo: payload });
            }
        },
        SET_EXTENDED_GUILD_INFO(state, payload) {
            const guild = state.storedGuilds.get(payload.guildId);
            guild.extendedInfo = payload;
        }
    },
    actions: {
        async fetchGuildBookmarks(context, payload) {
            const lsGuilds = localStorage.getItem('bookmarks') ? JSON.parse(localStorage.getItem('bookmarks')) : [];

            if (!lsGuilds.length) {
                context.commit('SET_GOT_BOOKMARKS_STORED', false);
                return;
            }

            const res = await postApi('info', { guilds: lsGuilds });

            if (res.guilds.length) {
                context.commit('SET_GUILD_BOOKMARKS', res.guilds);
                context.commit('SET_GOT_BOOKMARKS_STORED', true);
            } else {
                // Invalid bookmarks
                localStorage.removeItem('bookmarks');
            }
        },
        addGuildBookmark(context, payload) {
            const bookmarks = context.getters.getBookmarkedGuilds;
            bookmarks.push(payload);
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks.map(b => b.id)));
            context.commit('SET_GUILD_BOOKMARKS', bookmarks);
        },
        removeGuildBookmark(context, payload) {
            const bookmarks = context.getters.getBookmarkedGuilds.filter(b => b.id !== payload);
            localStorage.setItem('bookmarks', JSON.stringify(bookmarks.map(b => b.id)));
            context.commit('SET_GUILD_BOOKMARKS', bookmarks);
        },
        setBasicGuildInfo(context, payload) {
            context.commit('SET_BASIC_GUILD_INFO', payload);
        },
        async fetchBasicGuildInfo(context, payload) {
            const res = await postApi('info', { guilds: [payload] });

            if (res.guilds.length) {
                context.dispatch('setBasicGuildInfo', res.guilds[0]);
            }
        },
        async fetchExtendedGuildInfo(context, payload) {
            const res = await postApi('guildinfo', { id: payload });

            if (res.status === 'success') {
                context.dispatch('setBasicGuildInfo', {
                    id: res.guildId,
                    name: res.guildName,
                    icon: res.guildIcon
                });
                context.commit('SET_EXTENDED_GUILD_INFO', res);
            }
        }
    }
}