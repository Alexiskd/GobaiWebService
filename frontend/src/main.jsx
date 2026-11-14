// Fonction de React qui attache l'application à la page.
import { createRoot } from 'react-dom/client';
// Composant principal de l'application.
import App from './composante/App';
// Adresse de base de l'API.
import { API_ROOT } from './moteur/api/client';
// Lecture et surveillance de la version du serveur.
import { buildOf, watchBuild } from './moteur/lib/autoReload';
// Protection contre les erreurs React et redirection vers le domaine de secours.
import { FailoverBoundary, redirectToFailover } from './moteur/lib/failover';
// Importe le blocage des API externes : le garde de fetch et la lecture de l'état du serveur.
import { installFetchGuard, refreshServerBlocked } from './moteur/lib/apiBlock';
// Importe la garde de la racine React : dépôt, retrait du contenu de départ et démontage.
import { removeSeoShell, setAppRoot, unmountApp } from './moteur/lib/appRoot';

// Pose le garde avant de lancer l'application : une API déconnectée n'est plus appelée par le navigateur.
installFetchGuard();
// Lit la liste des API déconnectées sur le serveur (sans attendre : l'application démarre tout de suite).
refreshServerBlocked();

// Pas de <StrictMode> : le moteur WebGL (textures 8192 px, routes) est coûteux à initialiser.
// La racine React, gardée pour pouvoir être démontée (moteur/lib/appRoot) : « root » n'appartient qu'à React,
// le contenu de départ des moteurs de recherche vit à côté, dans « seo ».
const root = setAppRoot(createRoot(document.getElementById('root')));
// Affiche l'application, avec une frontière d'erreur.
root.render(
  // La frontière d'erreur (début).
  <FailoverBoundary>
    {/* L'application. */}
    <App />
  {/* Fin de la frontière d'erreur. */}
  </FailoverBoundary>,
// Fin de l'affichage.
);
// L'application est montée : le contenu de départ a fait son travail dans le HTML servi, on le retire pour ne
// pas laisser dans la page une seconde présentation que le traducteur et les lecteurs d'écran parcourraient.
removeSeoShell();

// Erreurs JavaScript globales : exceptions hors rendu React et promesses rejetées.
window.addEventListener('error', (event) => {
  // Redirige vers le secours.
  redirectToFailover('frontend-runtime-error');
// Fin de l'écoute des erreurs.
});
// À une promesse rejetée sans traitement (début).
window.addEventListener('unhandledrejection', () => {
  // Redirige vers le secours.
  redirectToFailover('frontend-unhandled-rejection');
// Fin de cette écoute.
});

// Application installée (écran d'accueil, Android) : service worker minimal, en production seulement.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Au chargement de la page : enregistre le service worker ; un échec est ignoré.
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
// Fin de ce cas.
}

// Redéploiement du site : les pages déjà ouvertes se rechargent d'elles-mêmes.
if (import.meta.env.PROD) {
  // checkBackend : interroge la santé de l'API (début),
  const checkBackend = () => fetch(`${API_ROOT}/health`, {
    // sans cache du navigateur,
    cache: 'no-store',
    // ni cache intermédiaire ;
    headers: { 'Cache-Control': 'no-cache' },
  // à la réponse (début) :
  }).then((response) => {
    // en erreur, redirige vers le secours avec le code HTTP ;
    if (!response.ok) redirectToFailover(`backend-http-${response.status}`);
    // renvoie la réponse ;
    return response;
  // sans réponse (début) :
  }).catch(() => {
    // redirige vers le secours ;
    redirectToFailover('backend-unreachable');
    // renvoie null.
    return null;
  // Fin de checkBackend.
  });

  // Surveillance de la version du serveur (début) :
  const watcher = watchBuild({
    // la version est lue dans la réponse de santé ;
    fetchBuild: () => checkBackend().then((response) => (response?.ok ? response.json() : null)).then(buildOf),
    // à une nouvelle version, la page se recharge.
    reload: () => window.location.reload(),
  // Fin de la surveillance.
  });

  // Vérifie l'API au démarrage puis périodiquement, même si aucun changement de build n'arrive.
  checkBackend();
  // Puis toutes les 20 secondes.
  const backendHealthInterval = window.setInterval(checkBackend, 20000);

  // Retour sur l'onglet ou retour du réseau : lecture immédiate.
  document.addEventListener('visibilitychange', () => {
    // Si l'onglet redevient visible (début).
    if (document.visibilityState === 'visible') {
      // Interroge l'API.
      checkBackend();
      // Relit la version.
      watcher.check();
    // Fin de ce cas.
    }
  // Fin de cette écoute.
  });
  // Au retour du réseau (début).
  window.addEventListener('online', () => {
    // Interroge l'API.
    checkBackend();
    // Relit la version.
    watcher.check();
  // Fin de cette écoute.
  });

  // Nettoyage si le navigateur décharge la page : le minuteur, puis React lui-même, pour que ses effets
  // (minuteries, écouteurs, animations du moteur 3D) s'arrêtent au lieu d'être coupés en plein vol.
  window.addEventListener('pagehide', () => { window.clearInterval(backendHealthInterval); unmountApp(); }, { once: true });
// Fin du cas « production ».
}
