// Importe defineConfig, la déclaration d'une configuration Vite.
import { defineConfig } from 'vite';
// Importe le module React de Vite.
import react from '@vitejs/plugin-react';
// Importe le module Tailwind CSS de Vite : compile la feuille de style de l'interface au build.
import tailwindcss from '@tailwindcss/vite';
// Importe les outils d'adresses de fichiers de Node.
import { fileURLToPath, URL } from 'node:url';

// Déclare et exporte la configuration (début).
export default defineConfig({
  // Modules : React et Tailwind CSS.
  plugins: [react(), tailwindcss()],
  // Construction (début).
  build: {
    // Seuil de l'avertissement de taille des fichiers produits : 2 500 ko (500 ko par défaut). Les fichiers sont déjà
    // découpés (three.js, Base UI, React, séries VSOP87A) ; three.js (~700 ko) et les séries VSOP87A (~1,3 Mo de source)
    // dépassent à eux seuls les 500 ko par défaut sans que ce soit un problème : ils restent en cache dans le navigateur.
    chunkSizeWarningLimit: 2500,
    // Options de Rollup (début).
    rollupOptions: {
      // Entrées : la page principale, puis la page d'embarquement (embed.html), servie dans une iframe transparente.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        embed: fileURLToPath(new URL('./embed.html', import.meta.url)),
      // Fin des entrées.
      },
      // Sortie (début).
      output: {
        // manualChunks : range chaque module dans un fichier (début).
        manualChunks(id) {
          // Hors des dépendances : choix automatique.
          if (!id.includes('/node_modules/')) return;
          // CesiumJS : fichier « cesium-vendor », chargé seulement à la première approche de la Terre.
          if (id.includes('/node_modules/cesium/') || id.includes('/node_modules/@cesium/')) return 'cesium-vendor';
          // three.js : fichier « three-vendor ».
          if (id.includes('/node_modules/three/')) return 'three-vendor';
          // Base UI, son moteur de placement et les icônes : fichier « ui-vendor ».
          if (id.includes('/node_modules/@base-ui/') || id.includes('/node_modules/@floating-ui/') || id.includes('/node_modules/react-icons/')) return 'ui-vendor';
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
      // « @ » désigne le dossier Car.
      '@': fileURLToPath(new URL('./Car', import.meta.url)),
    // Fin des alias.
    },
  // Fin de la résolution.
  },
  // Serveur de développement (début).
  server: {
    // Port 5173.
    port: 5173,
    // Relais vers l'API NestJS du dossier backend/ (même adresse « /api » qu'en ligne, où l'API sert le site).
    proxy: {
      '/api': { target: process.env.API_URL || 'http://localhost:3001', changeOrigin: true, ws: true },
    },
  // Fin du serveur de développement.
  },
});
