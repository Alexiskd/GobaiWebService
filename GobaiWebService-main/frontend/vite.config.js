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
    // Points d'entrée : application, page iframe, API ES module et Web Component publics.
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        embed: fileURLToPath(new URL('./embed.html', import.meta.url)),
        'gobai-embed': fileURLToPath(new URL('./src/embed/client.js', import.meta.url)),
        'gobai-planet': fileURLToPath(new URL('./src/embed/gobai-planet.js', import.meta.url)),
      },
      output: {
        entryFileNames: (chunk) => chunk.name === 'gobai-embed' || chunk.name === 'gobai-planet'
          ? '[name].js'
          : 'assets/[name]-[hash].js',
        manualChunks(id) {
          if (id.includes('/backend/src/services/ephemeris/vsop87a/')) return 'vsop87-data';
          if (!id.includes('/node_modules/')) return;
          if (id.includes('/node_modules/three/')) return 'three-vendor';
          if (id.includes('/node_modules/@mui/') || id.includes('/node_modules/@emotion/')) return 'ui-vendor';
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'react-vendor';
        },
      },
    },
    // Seuil de l'avertissement de taille des fichiers produits : 2 500 ko (500 ko par défaut). Les fichiers sont déjà
    // découpés (three.js, MUI, React, séries VSOP87A) ; three.js (~700 ko) et les séries VSOP87A (~1,3 Mo de source)
    // dépassent à eux seuls les 500 ko par défaut sans que ce soit un problème : ils restent en cache dans le navigateur.
    chunkSizeWarningLimit: 2500,
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
