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
    props: true,
    name: 'Help',
    redirect: '/help/firststeps',
    component: () => import('../views/help/Help.vue'),
    children: [
      {
        path: ':article',
        props: true,
        component: () => import('../views/help/HelpArticleView.vue')
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
