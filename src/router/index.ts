import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: 'Closer' },
  },
  {
    path: '/play/:puzzleSlug',
    name: 'play',
    component: () => import('@/views/PuzzleView.vue'),
    meta: { title: 'Play — Closer' },
  },
  {
    path: '/puzzles',
    name: 'puzzles',
    component: () => import('@/views/BrowseView.vue'),
    meta: { title: 'Puzzles — Closer' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: 'About — Closer' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || 'Closer'
  document.title = title
})

export default router
