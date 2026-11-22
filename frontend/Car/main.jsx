// Point d'entrée de l'application Gobai en mode site statique.
// Importe la feuille de style de l'interface (Tailwind CSS, compilée au build) et celle des éléments du moteur 3D.
import './Fairing/theme/app.css';
import './Fairing/theme/scene.css';
import { createRoot } from 'react-dom/client';
import App from './Fairing/App.jsx';
import { removeSeoShell, setAppRoot, unmountApp } from './Engine/shared/lib/app/appRoot.jsx';
import { purgeStoredTiles } from './Engine/AstreSolideEngine/PerfEngine/storagePurge.jsx';

// Nettoie les anciens caches incompatibles puis monte l'application côté navigateur.
purgeStoredTiles();
const root = setAppRoot(createRoot(document.getElementById('root')));
root.render(<App />);
removeSeoShell();

// Le service worker ne met en cache que les ressources statiques de cette version.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// Arrête proprement le moteur WebGL à la fermeture de la page.
window.addEventListener('pagehide', unmountApp, { once: true });
