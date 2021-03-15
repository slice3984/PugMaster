import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import BaseLink from '@/components/ui/BaseLink.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseIcon from '@/components/ui/BaseIcon.vue';
import BaseToastMessage from '@/components/ui/BaseToastMessage.vue';
import Container from '@/components/layout/Container.vue';

import { rootKey } from './store/types';

const app = createApp(App);

app.use(store, rootKey);
app.use(router);

app.component('base-link', BaseLink);
app.component('base-card', BaseCard);
app.component('base-icon', BaseIcon);
app.component('base-toast-message', BaseToastMessage);
app.component('container', Container);

app.mount('#app');
