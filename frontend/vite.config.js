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
    // Seuil de l'avertissement de taille des fichiers produits : 2 500 ko (500 ko par défaut). Les fichiers sont déjà
    // découpés (three.js, MUI, React, séries VSOP87A) ; three.js (~700 ko) et les séries VSOP87A (~1,3 Mo de source)
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
      // « @ » désigne le dossier Car.
      '@': fileURLToPath(new URL('./Car', import.meta.url)),
    // Fin des alias.
    },
  // Fin de la résolution.
  },

});
