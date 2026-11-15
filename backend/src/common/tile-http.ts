// createHash : calcule une empreinte (ici SHA-1) d'un contenu.
import { createHash } from 'node:crypto';

/**
 * Envoi d'une tuile au navigateur, sur le modèle des API de tuiles à grand trafic (Mapbox) :
 *
 *  - empreinte forte (`ETag`) calculée UNE fois par image gardée en mémoire, pas à chaque requête ;
 *  - requête conditionnelle : si le navigateur a déjà cette image (`If-None-Match`), réponse 304 sans corps — quelques
 *    centaines d'octets au lieu de la tuile entière ;
 *  - `Cache-Control` explicite, avec `stale-while-revalidate` : passé le délai, le navigateur affiche tout de suite la
 *    tuile qu'il a et la vérifie en arrière-plan (le plus souvent par un 304), au lieu d'attendre le réseau ;
 *  - `immutable` pour les mosaïques qui ne changent pas : aucune revérification pendant la durée de cache ;
 *  - `Content-Length` connu d'avance : pas d'envoi par morceaux.
 * Les réponses sont publiques (`public`) : un cache partagé placé devant le service (CDN) peut les garder.
 */

/** Durées de cache d'une tuile, en secondes. */
// Forme d'une règle de cache : durée de validité, durée facultative d'affichage immédiat avec vérification, et marque facultative « immuable ».
export interface TileCachePolicy { maxAge: number; staleWhileRevalidate?: number; immutable?: boolean }

// Nombre de secondes dans un jour.
export const DAY_S = 86_400;
/** Imagerie de la Terre (meilleure source) : une semaine, puis un mois d'affichage immédiat avec vérification. */
// Terre : 7 jours, puis 30 jours d'affichage immédiat avec vérification.
export const EARTH_TILE: TileCachePolicy = { maxAge: 7 * DAY_S, staleWhileRevalidate: 30 * DAY_S };
/** Imagerie de la Terre servie par une source de repli : dix minutes, pour que la meilleure image revienne. */
// Terre servie par une source de repli : 600 secondes.
export const EARTH_FALLBACK_TILE: TileCachePolicy = { maxAge: 600 };
/** Mosaïques des satellites et des géantes gazeuses : figées. */
// Satellites et géantes gazeuses : 7 jours, immuable.
export const SATELLITE_TILE: TileCachePolicy = { maxAge: 7 * DAY_S, immutable: true };
/** Lune : l'adresse porte un numéro de version, la tuile ne change jamais. */
// Lune : 365 jours, immuable.
export const MOON_TILE: TileCachePolicy = { maxAge: 365 * DAY_S, immutable: true };
/** Fusions de Mars calculées par le serveur : une heure, puis un jour d'affichage immédiat avec vérification. */
// Mars : 3 600 secondes, puis un jour d'affichage immédiat avec vérification.
export const MARS_TILE: TileCachePolicy = { maxAge: 3600, staleWhileRevalidate: DAY_S };
/** Nuages vus par satellite : image du moment, un quart d'heure. */
// Nuages : 900 secondes.
export const CLOUD_TILE: TileCachePolicy = { maxAge: 900 };

// Fonction tileCacheControl : écrit l'en-tête Cache-Control d'une règle.
export function tileCacheControl(policy: TileCachePolicy): string {
  // Commence par « public » et « max-age » : la durée arrondie à l'entier inférieur, jamais négative.
  const parts = ['public', `max-age=${Math.max(0, Math.floor(policy.maxAge))}`];
  // Règle immuable : ajoute « immutable ».
  if (policy.immutable) parts.push('immutable');
  // Sinon, si une durée d'affichage immédiat positive est donnée : ajoute « stale-while-revalidate » avec cette durée.
  else if (policy.staleWhileRevalidate && policy.staleWhileRevalidate > 0) parts.push(`stale-while-revalidate=${Math.floor(policy.staleWhileRevalidate)}`);
  // Assemble les morceaux avec des virgules.
  return parts.join(', ');
// Fin de tileCacheControl.
}

// Table image → empreinte ; « faible » : l'entrée disparaît toute seule quand l'image n'est plus gardée en mémoire.
const etags = new WeakMap<Buffer, string>();

/** Empreinte forte d'une image : taille + SHA-1 abrégé. Gardée avec l'image tant qu'elle reste en mémoire. */
// Fonction tileEtag : renvoie l'empreinte d'une image.
export function tileEtag(body: Buffer): string {
  // Cherche une empreinte déjà calculée pour cette image.
  let tag = etags.get(body);
  // S'il n'y en a pas :
  if (!tag) {
    // la calcule : entre guillemets, la taille en hexadécimal, un tiret, puis les 22 premiers caractères du SHA-1 en base64 pour URL ;
    tag = `"${body.length.toString(16)}-${createHash('sha1').update(body).digest('base64url').slice(0, 22)}"`;
    // et la range dans la table.
    etags.set(body, tag);
  // Fin du calcul.
  }
  // Renvoie l'empreinte.
  return tag;
// Fin de tileEtag.
}

/** L'en-tête `If-None-Match` du navigateur désigne-t-il cette empreinte ? (liste, `*`, préfixe faible `W/` acceptés) */
// Fonction etagMatches : l'en-tête If-None-Match (texte, liste ou absent) désigne-t-il cette empreinte ?
export function etagMatches(header: string | string[] | undefined, etag: string): boolean {
  // Sans en-tête : non.
  if (!header) return false;
  // Une liste est d'abord jointe en un seul texte.
  const value = Array.isArray(header) ? header.join(',') : header;
  // Coupe aux virgules, retire les espaces, et répond oui si un élément vaut « * », l'empreinte, ou sa forme faible « W/… ».
  return value.split(',').map((c) => c.trim()).some((c) => c === '*' || c === etag || c === `W/${etag}`);
// Fin de etagMatches.
}

/** Sous-ensembles de la requête et de la réponse Express dont l'envoi a besoin (évite une dépendance de types). */
// Forme minimale de la requête : ses en-têtes.
export interface TileRequest { headers: Record<string, string | string[] | undefined> }
// Forme minimale de la réponse :
export interface TileResponse {
  // poser un en-tête ;
  setHeader(name: string, value: string): unknown;
  // fixer le code ;
  status(code: number): unknown;
  // terminer, avec ou sans corps.
  end(body?: Buffer): unknown;
// Fin de TileResponse.
}

/** Envoie la tuile, ou un 304 sans corps si le navigateur l'a déjà. `extra` : en-têtes propres à la route. */
// Fonction sendTile ; ses paramètres :
export function sendTile(
  // la requête, la réponse, la tuile (contenu et type) et la règle de cache ;
  req: TileRequest, res: TileResponse, tile: { body: Buffer; contentType: string }, policy: TileCachePolicy,
  // des en-têtes supplémentaires, aucun par défaut.
  extra: Record<string, string> = {},
// Elle ne renvoie rien.
): void {
  // Empreinte de l'image.
  const etag = tileEtag(tile.body);
  // En-tête ETag.
  res.setHeader('ETag', etag);
  // En-tête Cache-Control d'après la règle.
  res.setHeader('Cache-Control', tileCacheControl(policy));
  // Pose chaque en-tête supplémentaire.
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  // Si le navigateur possède déjà cette image :
  if (etagMatches(req.headers['if-none-match'], etag)) {
    // code 304 ;
    res.status(304);
    // réponse terminée sans corps ;
    res.end();
    // et on s'arrête.
    return;
  // Fin du cas 304.
  }
  // Type de l'image.
  res.setHeader('Content-Type', tile.contentType);
  // Taille de l'image, connue d'avance.
  res.setHeader('Content-Length', String(tile.body.length));
  // Envoie l'image et termine la réponse.
  res.end(tile.body);
// Fin de sendTile.
}
