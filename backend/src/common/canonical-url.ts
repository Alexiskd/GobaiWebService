// Adresse officielle du site (https://www.gobaispace.com) et recherche de la page d'un astre d'après son adresse.
import { SITE_URL, bodyPageFor } from '../services/core/data/body-pages';

/**
 * Adresse unique pour le référencement : chaque page n'a qu'une seule adresse, celle du sitemap.
 *  - autre hôte (gobai-space.onrender.com, gobaispace.com sans www…) → 301 vers https://www.gobaispace.com, même chemin ;
 *  - page d'astre écrite autrement (/Mars, /mars/, /ganymède) → 301 vers son adresse du sitemap (/mars, /ganymede) ;
 *  - autre chemin sans extension terminé par « / » (/galerie/) → 301 sans la barre finale.
 * Jamais pour l'API (/api), les fichiers /.well-known, ni les méthodes autres que GET et HEAD (webhooks Stripe, formulaires).
 * Active seulement en production sur Render (variable RENDER), hors environnements de prévisualisation (IS_PULL_REQUEST).
 */

// Hôte officiel, tiré de l'adresse du site : « www.gobaispace.com ».
export const CANONICAL_HOST = new URL(SITE_URL).host;

// Ce dont la fonction a besoin d'une requête : la méthode, l'hôte demandé et l'adresse complète (chemin et paramètres).
export interface CanonicalRequest {
  // Méthode HTTP (GET, HEAD, POST…).
  method: string;
  // En-tête Host tel qu'envoyé par le navigateur (peut contenir un port et des majuscules), ou undefined.
  host: string | undefined;
  // Adresse demandée, chemin et paramètres compris (/mars?x=1).
  originalUrl: string;
}

/** La redirection est-elle active ? Oui sur le service Render en production, non en développement ni en prévisualisation. */
// Déclare canonicalRedirectEnabled : reçoit l'environnement (process.env par défaut) et renvoie vrai ou faux.
export function canonicalRedirectEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  // Interrupteur manuel : CANONICAL_REDIRECT=off coupe la redirection sans redéployer de code.
  if (env.CANONICAL_REDIRECT?.trim().toLowerCase() === 'off') return false;
  // Environnement de prévisualisation de Render (IS_PULL_REQUEST=true) : il doit rester sur sa propre adresse.
  if (env.IS_PULL_REQUEST === 'true') return false;
  // Actif seulement sur Render, qui pose la variable RENDER ; en local (localhost), rien ne change.
  return Boolean(env.RENDER);
// Fin de canonicalRedirectEnabled.
}

/** Adresse vers laquelle rediriger en 301, ou null si la requête est déjà sur sa bonne adresse. */
// Déclare canonicalRedirect : reçoit la requête et renvoie l'adresse complète de destination, ou null.
export function canonicalRedirect(req: CanonicalRequest): string | null {
  // Seules les lectures sont redirigées : un POST redirigé perdrait son contenu.
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  // Position du « ? » qui sépare le chemin des paramètres ; -1 s'il n'y a pas de paramètres.
  const q = req.originalUrl.indexOf('?');
  // Chemin seul, sans les paramètres.
  const path = q === -1 ? req.originalUrl : req.originalUrl.slice(0, q);
  // Paramètres, « ? » compris, gardés tels quels dans la destination (chaîne vide s'il n'y en a pas).
  const query = q === -1 ? '' : req.originalUrl.slice(q);
  // L'API et /.well-known (assetlinks.json, appelé par Android) ne sont jamais redirigés.
  if (path === '/api' || path.startsWith('/api/') || path.startsWith('/.well-known/')) return null;

  // Hôte demandé, en minuscules et sans le port (« WWW.GobaiSpace.com:443 » devient « www.gobaispace.com »).
  const host = (req.host ?? '').toLowerCase().replace(/:\d+$/, '');
  // Chemin de destination : au départ, le même chemin.
  let target = path;
  // Page d'un astre ou d'une fenêtre reconnue (/mars, /Mars/, /ganymède…) ; undefined sinon.
  const page = bodyPageFor(path);
  // Page reconnue : sa seule adresse est /<slug>, celle du sitemap.
  if (page) target = `/${page.slug}`;
  // Autre chemin sans extension terminé par « / » (sauf la racine) : barre finale retirée.
  else if (path.length > 1 && path.endsWith('/') && !/\.[a-z0-9]+\/$/i.test(path)) target = path.replace(/\/+$/, '') || '/';

  // Déjà sur l'hôte officiel et sur le bon chemin : aucune redirection.
  if (host === CANONICAL_HOST && target === path) return null;
  // Sinon : adresse officielle, chemin corrigé, paramètres d'origine.
  return `${SITE_URL}${target}${query}`;
// Fin de canonicalRedirect.
}
