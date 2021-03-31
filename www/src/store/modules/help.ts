import { Module } from 'vuex';
import { HelpNavSection, HelpState, RootState } from '../types';

export const helpModule: Module<HelpState, RootState> = {
    namespaced: true,
    state: {
        helpNavSections: [
            {
                name: 'Setup',
                links: [
                    {
                        id: 'firststeps',
                        title: 'First steps'
                    },
                    {
                        id: 'settings',
                        title: 'Settings'
                    },
                    {
                        id: 'ratingsetup',
                        title: 'Setting up rating / elo'
                    }
                ]
            },
            {
                name: 'Configuration variables',
                links: [
                    {
                        id: 'botvariables',
                        title: 'Bot variables'
                    },
                    {
                        id: 'pickupvariables',
                        title: 'Pickup variables'
                    }
                ]
            },
            {
                name: 'Miscellaneous',
                links: [
                    {
                        id: 'introduction',
                        title: 'Introduction for players new to pickups'
                    },
                    {
                        id: 'permissions',
                        title: 'Set permissions, create a moderator role'
                    },
                    {
                        id: 'ratinghelp',
                        title: 'How does rating work?'
                    },
                    {
                        id: 'pickmodes',
                        title: 'Pickmodes explained'
                    },
                    {
                        id: 'botmessages',
                        title: 'Setting start, notify and sub messages'
                    }
                ]
            }
        ]
    },
    getters: {
        getHelpNavSections(state): HelpNavSection[] {
            return state.helpNavSections;
        }
    },
    mutations: {

    },
    actions: {

    }
}