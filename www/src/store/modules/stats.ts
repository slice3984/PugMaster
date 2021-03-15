import { Module } from 'vuex';
import postApi from '../postApi';
import { GuildBookmark, RootState, StatsState } from '../types';

export const statsModule: Module<StatsState, RootState> = {
    namespaced: true,
    state: {
        gotGuildBookmarks: null,
        bookmarkedGuilds: []
    },
    getters: {
        getBookmarkedGuilds(state): GuildBookmark[] {
            return state.bookmarkedGuilds;
        },
        gotBookmarkedGuilds(state): boolean | null {
            return state.gotGuildBookmarks;
        }
    },
    mutations: {
        SET_GUILD_BOOKMARKS(state, payload) {
            state.bookmarkedGuilds = payload;
        },
        SET_GOT_BOOKMARKS_STORED(state, payload) {
            state.gotGuildBookmarks = payload;
        },
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
        }
    }
}