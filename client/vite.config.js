import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 3000,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      },
      '/__log__': {
        target: 'http://localhost:1234',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:1234',
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist'
  }
})