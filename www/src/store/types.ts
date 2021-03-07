import { InjectionKey } from 'vue';
import { Store } from 'vuex';

export interface RootState {
}

export interface HelpState {
    helpNavSections: HelpNavSection[]
}

export const rootKey: InjectionKey<Store<RootState>> = Symbol();

export interface HelpNavLink {
    id: String;
    title: String;
}

export interface HelpNavSection {
    name: String,
    links: HelpNavLink[]
}