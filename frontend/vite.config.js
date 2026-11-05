import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@lidar': fileURLToPath(new URL('./lidar', import.meta.url)), // moteur LiDAR (LAS / LAZ)
    },
  },
  // Le worker LiDAR charge laz-perf à la demande (import dynamique) : format ES obligatoire.
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['laz-perf'] }, // garde laz-perf.wasm à côté de son module
  server: {
    port: 5173,
    // En développement, /api est relayé vers le backend NestJS.
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:3001', changeOrigin: true, ws: true },
    },
  },
});
