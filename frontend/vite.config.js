// Importe defineConfig, la déclaration d'une configuration Vite.
import { defineConfig } from 'vite';
// Importe le module React de Vite.
import react from '@vitejs/plugin-react';
// Importe les outils d'adresses de fichiers de Node.
import { fileURLToPath, URL } from 'node:url';

// Déclare et exporte la configuration (début).
export default defineConfig({
  // Modules : React.
  plugins: [react()],
  // Construction (début).
  build: {
    // Options de Rollup (début).
    rollupOptions: {
      // Sortie (début).
      output: {
        // manualChunks : range chaque module dans un fichier (début).
        manualChunks(id) {
          // Séries VSOP87A : données scientifiques séparées du bundle applicatif pour le cache navigateur.
          if (id.includes('/backend/src/services/ephemeris/vsop87a/')) return 'vsop87-data';
          // Hors des dépendances : choix automatique.
          if (!id.includes('/node_modules/')) return;
          // three.js : fichier « three-vendor ».
          if (id.includes('/node_modules/three/')) return 'three-vendor';
          // MUI et Emotion : fichier « ui-vendor ».
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) return 'ui-vendor';
          // React, React DOM et scheduler : fichier « react-vendor ».
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react-vendor';
        // Fin de manualChunks.
        },
      // Fin de la sortie.
      },
    // Fin des options de Rollup.
    },
  // Fin de la construction.
  },
  // Résolution des chemins (début).
  resolve: {
    // Alias (début).
    alias: {
      // « @ » désigne le dossier src.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    // Fin des alias.
    },
  // Fin de la résolution.
  },
  // Serveur de développement (début).
  server: {
    // Port 5173.
    port: 5173,
    // En développement, /api est relayé vers le backend NestJS.
    // Relais (début).
    proxy: {
      // /api vers le backend, sur le port 3001 par défaut, WebSocket compris.
      '/api': { target: process.env.API_URL || 'http://localhost:3001', changeOrigin: true, ws: true },
    // Fin du relais.
    },
  // Fin du serveur.
  },
// Fin de la configuration.
});
