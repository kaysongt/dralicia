import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: '/dralicia/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        audit: resolve(__dirname, 'audit.html'),
        404: resolve(__dirname, '404.html'),
      }
    }
  }
})
