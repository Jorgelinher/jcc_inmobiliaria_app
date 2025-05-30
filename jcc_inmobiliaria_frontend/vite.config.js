// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Asegúrate que este sea el puerto donde corre tu frontend de Vite
    proxy: {
      // Redirige las peticiones que comienzan con /api al servidor de Django
      '/api': {
        target: 'http://127.0.0.1:8000', // La URL de tu backend de Django
        changeOrigin: true, // Necesario para que el backend reciba la petición como si viniera del mismo origen
        // No necesitas 'rewrite' si tus URLs en Django ya empiezan con /api/
        // (ej. /api/auth/login/, /api/gestion/lotes/)
        // Si tus URLs en Django NO tuvieran el prefijo /api/ (ej. /auth/login/), entonces sí necesitarías:
        // rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
