import { createStore } from 'vuex'
import { helpModule } from './modules/help';
import { commandModule } from './modules/command';
import { RootState } from './types';

export default createStore<RootState>({
  state: {
  },
  getters: {
  },
  mutations: {
  },
  actions: {
  },
  modules: {
    'help': helpModule,
    'command': commandModule
  }
})
