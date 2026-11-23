/**
 * Lien de la vue du globe de près : l'ancre de l'adresse décrit le point de vue (latitude, longitude, altitude,
 * cap, inclinaison), par exemple https://www.gobaispace.com/terre#vue=48.99000,2.09000,2500,40,-35. L'astre est
 * celui de l'adresse (/terre, /lune…). Fonctions pures.
 */

// Déclare et exporte le préfixe de l'ancre.
export const VIEW_HASH_KEY = 'vue';
/** Délai minimal (ms) entre deux mises à jour de l'adresse. */
// Déclare et exporte le délai.
export const VIEW_LINK_MS = 1000;

/** Ancre de la vue : latitude, longitude (degrés, 5 décimales ≈ 1 m), altitude (m), cap et inclinaison (degrés). */
// Déclare et exporte formatViewHash : la vue (début).
export function formatViewHash({ lat, lon, altM, heading = 0, pitch = -90 }) {
  // Vue illisible : pas d'ancre.
  if (![lat, lon, altM].every(Number.isFinite)) return '';
  // Cap ramené entre 0 et 360 degrés.
  const h = ((Math.round(heading) % 360) + 360) % 360;
  // Ancre.
  return `#${VIEW_HASH_KEY}=${lat.toFixed(5)},${lon.toFixed(5)},${Math.round(altM)},${h},${Math.round(Number.isFinite(pitch) ? pitch : -90)}`;
// Fin de formatViewHash.
}

/** Vue lue dans l'ancre de l'adresse, ou null si l'ancre n'en décrit pas une valide. */
// Déclare et exporte parseViewHash : l'ancre (début).
export function parseViewHash(hash) {
  // Ancre « #vue=… » attendue.
  const m = /^#?vue=([^&]+)$/.exec(String(hash ?? '').trim());
  // Absente : rien.
  if (!m) return null;
  // Les cinq nombres (cap et inclinaison facultatifs).
  const [lat, lon, altM, heading = 0, pitch = -90] = m[1].split(',').map(Number);
  // Illisibles ou hors bornes : rien.
  if (![lat, lon, altM, heading, pitch].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || altM <= 0 || pitch > 0 || pitch < -90) return null;
  // Renvoie la vue.
  return { lat, lon, altM, heading: ((heading % 360) + 360) % 360, pitch };
// Fin de parseViewHash.
}

/** Remplace l'ancre de l'adresse (sans ajouter d'entrée à l'historique) ; '' l'efface. Sans navigateur : rien. */
// Déclare et exporte setViewHash : la nouvelle ancre (début).
export function setViewHash(hash) {
  // Adresse et historique du navigateur.
  const loc = globalThis.location, hist = globalThis.history;
  // Sans navigateur, ou ancre déjà en place : rien.
  if (!loc || !hist?.replaceState || loc.hash === hash) return;
  // Début du bloc protégé : le navigateur peut refuser.
  try {
    // Même chemin, mêmes paramètres, nouvelle ancre.
    hist.replaceState(hist.state, '', `${loc.pathname}${loc.search}${hash}`);
  // Un refus est ignoré.
  } catch { /* adresse inchangée : sans conséquence */ }
// Fin de setViewHash.
}
