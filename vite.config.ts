import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/menu-backend': {
        target: 'https://wipe-coming-reoccupy.ngrok-free.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/menu-backend/, ''),
      },
    },
  },
})
