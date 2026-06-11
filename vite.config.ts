import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiTarget = 'https://pitsdog-api-production.up.railway.app'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api-backend': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
          })
        },
        rewrite: (path) => path.replace(/^\/api-backend/, ''),
      },
      '/menu-backend': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin')
          })
        },
        rewrite: (path) => path.replace(/^\/menu-backend/, ''),
      },
    },
  },
})
