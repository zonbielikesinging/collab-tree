import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import './style.css'
import './utils/remote-log.js'

const app = createApp(App)
app.use(router)
app.mount('#app')