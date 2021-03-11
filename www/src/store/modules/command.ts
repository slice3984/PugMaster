import { Module } from 'vuex';
import { CommandCategory, CommandInfo, CommandState, RootState } from '../types';
import postApi from '../postApi';


export const commandModule: Module<CommandState, RootState> = {
    namespaced: true,
    state: {
        commandCategories: [],
        commands: new Map()
    },
    getters: {
        getCommandCategories(state): CommandCategory[] {
            return state.commandCategories;
        },
        getCommand: (state) => (name): CommandInfo => {
            return state.commands.get(name);
        }

    },
    mutations: {
        SET_COMMAND_CATEGORIES(state, payload) {
            state.commandCategories = payload;
        },
        SET_COMMAND(state, payload: CommandInfo) {
            state.commands.set(payload.cmd, payload);
        }
    },
    actions: {
        async fetchCommandCategories(context, payload) {
            const res = await postApi('commands', {});
            context.commit('SET_COMMAND_CATEGORIES', res.categories);
        },
        async fetchCommand(context, payload) {
            const res = await postApi('commandInfo', { command: payload });
            context.commit('SET_COMMAND', res);
        }
    }
}