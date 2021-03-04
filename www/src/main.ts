import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'

import BaseLink from '@/components/ui/BaseLink.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import Container from '@/components/layout/Container.vue';

const app = createApp(App);

app.use(store);
app.use(router);

app.component('base-link', BaseLink);
app.component('base-card', BaseCard);
app.component('container', Container);

app.mount('#app');
