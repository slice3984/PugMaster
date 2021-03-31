import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Home from '../views/Home.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Home',
    component: Home
  },
  {
    path: '/about',
    name: 'About',
    component: () => import('../views/About.vue')
  },
  {
    path: '/help',
    name: 'Help',
    redirect: '/help/firststeps',
    component: () => import('../views/help/Help.vue'),
    children: [
      {
        path: ':article',
        name: 'Help',
        props: true,
        component: () => import('../views/help/HelpArticleView.vue')
      }
    ]
  },
  {
    path: '/commands',
    name: 'Commands',
    redirect: '/commands/acceptsub',
    component: () => import('../views/commands/Commands.vue'),
    children: [
      {
        path: ':command',
        name: 'Command',
        props: true,
        component: () => import('../views/commands/CommandView.vue')
      }
    ]
  },
  {
    path: '/stats',
    name: 'stats-search',
    component: () => import('../views/stats/GuildSearch.vue')
  },
  {
    path: '/stats/:guildId',
    name: 'stats-view',
    props: true,
    component: () => import('../views/stats/StatsView.vue'),
    children: [
      {
        path: 'overview',
        name: 'overview',
        props: true,
        component: () => import('../views/stats/Overview.vue')
      },
      {
        path: 'pickups/:pickupId?',
        name: 'pickups',
        props: true,
        component: () => import('../views/stats/PickupHistory.vue')
      },
      {
        path: 'player',
        name: 'player-search',
        props: true,
        component: () => import('../views/stats/PlayerSearch.vue')
      },
      {
        path: 'player/:playerId',
        name: 'player-view',
        props: true,
        component: () => import('../views/stats/PlayerView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

router.beforeEach(to => {
  // Temp fix: null id for guildId param
  // Breaks navigation when navigting from /stats/:guildId and its nested routes
  if (!['stats-view', 'stats-search', 'overview', 'pickups', 'player-search', 'player-view'].includes(to.name.toString())) {
    to.params = { ...to.params, guildId: null };
  }

  const routeName = String(to.name);
  let title = '';

  switch (routeName) {
    case 'Command': title = `Command: ${to.params.command}`; break;
    case 'stats-search': title = 'Search'; break;
    case 'stats-view': title = 'Stats'; break;
    case 'overview': title = 'Overview'; break;
    case 'history': title = 'History'; break;
    case 'player-search': title = 'Player search'; break;
    case 'player-view': title = "Player stats"; break;
    default:
      title = routeName;
  }

  document.title = title;
});

export default router
