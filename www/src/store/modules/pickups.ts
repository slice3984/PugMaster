import { Module } from 'vuex';
import postApi from '../postApi';
import { PickupInfo, PickupsState, RootState } from '../types';

export const pickupsModule: Module<PickupsState, RootState> = {
    namespaced: true,
    state: {
        guilds: new Map()
    },
    getters: {
        getPickupInfo: state => (guildId, pickupId): PickupInfo => {
            const guildPickups = state.guilds.get(guildId);

            if (guildPickups) {
                const pickupInfo = guildPickups.get(pickupId);
                return pickupInfo;
            } else {
                return null;
            }
        }
    },
    mutations: {
        SET_PICKUP_INFO(state, payload) {
            const guild = state.guilds.get(payload.guildId);

            if (guild) {
                guild.set(payload.pickupInfo.id, payload.pickupInfo);
            } else {
                state.guilds.set(payload.guildId, new Map([[payload.pickupInfo.id, payload.pickupInfo]]));

            }
        }
    },
    actions: {
        async fetchPickup(context, payload) {
            const res = await postApi('pickup-info', {
                id: payload.guildId,
                pickup: payload.pickupId
            });

            context.commit('SET_PICKUP_INFO', {
                guildId: payload.guildId,
                pickupInfo: res
            })
        }
    }
}