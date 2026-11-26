import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Si el 5173 está ocupado, falla en vez de cambiar de puerto: el back solo
    // acepta peticiones desde los orígenes de CORS_ORIGINS
    strictPort: true,
    proxy: {
      // El front llama a /api en su mismo origen y Vite lo reenvía al back.
      // Así la cookie de sesión es de primera parte (igual que con el rewrite
      // de Render en producción).
      '/api': 'http://localhost:3000',
    },
  },
})
