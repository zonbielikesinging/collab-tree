import { createRouter, createWebHashHistory } from 'vue-router'
import HomePage from './pages/HomePage.vue'
import CanvasPage from './pages/CanvasPage.vue'

const routes = [
  { path: '/', name: 'home', component: HomePage },
  { path: '/canvas/:id', name: 'canvas', component: CanvasPage },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router