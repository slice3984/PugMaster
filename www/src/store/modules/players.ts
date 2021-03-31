import { Module } from 'vuex';
import postApi from '../postApi';
import { PlayersState, PlayerStats, RootState } from '../types';

export const playersModule: Module<PlayersState, RootState> = {
    namespaced: true,
    state: {
        guilds: new Map()
    },
    getters: {
        getPlayerStats: state => (guildId, playerId): PlayerStats => {
            const guildPlayerStats = state.guilds.get(guildId);

            if (guildPlayerStats) {
                const playerStats = guildPlayerStats.players.get(playerId);
                return playerStats;
            } else {
                return null;
            }
        },
        getGuildPickups: state => guildId => {
            const guildPlayerStats = state.guilds.get(guildId);

            if (guildPlayerStats) {
                return guildPlayerStats.guildPickups;
            } else {
                return null;
            }
        }
    },
    mutations: {
        SET_PLAYER_STATS(state, payload) {
            const guildPlayerStats = state.guilds.get(payload.guildId);
            guildPlayerStats.players.set(payload.playerStats.id, payload.playerStats);
        },
        SET_GUILD_PICKUPS(state, payload) {
            state.guilds.set(payload.guildId, {
                guildPickups: payload.guildPickups,
                players: new Map()
            })
        }
    },
    actions: {
        async fetchGuildPickups(context, payload,) {
            const res = await postApi('played-pickups', { id: payload });

            context.commit('SET_GUILD_PICKUPS', {
                guildId: payload,
                guildPickups: res
            })
        },

        async fetchPlayerStats(context, payload) {
            const res = await postApi('player', { id: payload.guildId, player: payload.playerId });

            context.commit('SET_PLAYER_STATS', {
                guildId: payload.guildId,
                playerStats: res
            });
        }
    }
}