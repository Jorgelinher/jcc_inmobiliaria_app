// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    exclude: ['src/test/e2e/**/*', 'node_modules/**/*', '**/node_modules/**', '**/e2e/**'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000'
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  publicDir: 'public'
})
