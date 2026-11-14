// Service worker minimal de l'application installée (Android, écran d'accueil).
// Il ne met en cache que la page d'accueil, pour afficher l'application quand le réseau manque au lancement ;
// tout le reste (scripts, tuiles, API) passe par le réseau comme sans service worker.
// Nom du cache de la page d'accueil.
const SHELL = 'gobai-shell-v1';

// À l'installation (début).
self.addEventListener('install', (event) => {
  // Attend (début)
  event.waitUntil(
    // l'enregistrement de la page d'accueil, relue sur le réseau ; un échec est ignoré.
    caches.open(SHELL).then((cache) => cache.add(new Request('/', { cache: 'reload' }))).catch(() => {}),
  // Fin de l'attente.
  );
  // S'active sans attendre la fermeture des pages.
  self.skipWaiting();
// Fin de l'installation.
});

// À l'activation (début).
self.addEventListener('activate', (event) => {
  // Attend (début)
  event.waitUntil(Promise.all([
    // la prise en charge des pages ouvertes,
    self.clients.claim(),
    // Anciennes versions de ce cache uniquement : les autres caches du site ne sont pas touchés.
    // et la suppression des anciennes versions de ce cache.
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('gobai-shell-') && k !== SHELL).map((k) => caches.delete(k)))),
  // Fin de l'attente.
  ]));
// Fin de l'activation.
});

// À chaque requête (début).
self.addEventListener('fetch', (event) => {
  // La requête.
  const request = event.request;
  // Autre chose qu'une ouverture de page : le navigateur s'en charge.
  if (request.mode !== 'navigate') return; // seules les ouvertures de page sont prises en charge
  // Répond (début)
  event.respondWith(
    // par le réseau d'abord ;
    fetch(request)
      // à la réponse (début) :
      .then((response) => {
        // Réseau d'abord : la page d'accueil en cache est toujours la dernière reçue.
        // si elle est bonne et que c'est la page d'accueil (début),
        if (response.ok && new URL(request.url).pathname === '/') {
          // en fait une copie
          const copy = response.clone();
          // et la range dans le cache ; un échec est ignoré.
          caches.open(SHELL).then((cache) => cache.put('/', copy)).catch(() => {});
        // Fin de ce cas.
        }
        // Renvoie la réponse.
        return response;
      // Fin de la réponse.
      })
      // Sans réseau : la page d'accueil en cache, sinon une erreur.
      .catch(() => caches.match('/').then((cached) => cached || Response.error())),
  // Fin de la réponse à la requête.
  );
// Fin du traitement des requêtes.
});
