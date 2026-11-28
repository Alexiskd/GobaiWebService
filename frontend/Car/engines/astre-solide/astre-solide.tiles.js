/**
 * Profils de tuiles du globe CesiumJS, astre par astre (plan de refonte, étape 4). Un moteur réglé par une table :
 * chaque astre solide a sa finesse de tuiles (erreur d'écran tolérée, en pixels) et sa mémoire de tuiles, sur
 * ordinateur et sur chaque gamme de téléphone (PerfEngine/deviceTier.jsx), et dit si le fond des océans est en relief.
 *
 * La finesse suit la donnée : un astre dont les images et le relief s'arrêtent tôt (Vénus : niveau 5) n'a pas besoin
 * d'une finesse d'ordinateur, CesiumJS agrandirait des tuiles déjà au bout de leur définition. Les niveaux les plus fins
 * des images et du relief restent ceux des sources (imageryOptions, solidRelief) : CesiumJS ne demande rien au-delà.
 */

/**
 * Profils. sse : erreur d'écran au repos (ordinateur, puis téléphone par gamme) ; cache : tuiles gardées en mémoire ;
 * oceanFloor : fond des océans en relief (Terre : bathymétrie des tuiles AWS, GEBCO / ETOPO).
 */
// Déclare et exporte les profils (début).
export const TILE_PROFILES = Object.freeze({
  earth: { sse: { desktop: 2, high: 3, mid: 4, low: 6 }, cache: { desktop: 400, high: 150, mid: 90, low: 50 }, oceanFloor: true },
  moon: { sse: { desktop: 2, high: 3, mid: 4, low: 6 }, cache: { desktop: 300, high: 120, mid: 80, low: 50 }, oceanFloor: false },
  mars: { sse: { desktop: 2, high: 4, mid: 5, low: 6 }, cache: { desktop: 200, high: 90, mid: 70, low: 50 }, oceanFloor: false },
  mercury: { sse: { desktop: 2, high: 4, mid: 5, low: 6 }, cache: { desktop: 150, high: 80, mid: 60, low: 50 }, oceanFloor: false },
  venus: { sse: { desktop: 3, high: 5, mid: 6, low: 6 }, cache: { desktop: 120, high: 60, mid: 50, low: 40 }, oceanFloor: false },
// Fin des profils.
});

/** Profil d'un astre (celui de la Terre pour un astre sans profil). */
// Déclare et exporte tileProfile : l'identifiant de l'astre.
export const tileProfile = (bodyId) => TILE_PROFILES[bodyId] ?? TILE_PROFILES.earth;

/** Clé de l'appareil dans un profil : « desktop », ou la gamme du téléphone. */
// deviceKey : écran tactile et gamme.
const deviceKey = (touch, tier) => (touch ? (['high', 'mid', 'low'].includes(tier) ? tier : 'high') : 'desktop');

/** Erreur d'écran tolérée (pixels) : celle du profil au repos, + 2 en mouvement (moins de tuiles pendant le geste). */
// Déclare et exporte profileScreenError (début).
export function profileScreenError({ bodyId = 'earth', moving = false, touch = false, tier = 'high' } = {}) {
  // Repos selon l'astre et l'appareil, plus le surcoût du mouvement.
  return tileProfile(bodyId).sse[deviceKey(touch, tier)] + (moving ? 2 : 0);
// Fin de profileScreenError.
}

/** Mémoire des tuiles et préchargement (voisines sur ordinateur seulement, ancêtres partout). */
// Déclare et exporte profileCacheOptions (début).
export function profileCacheOptions({ bodyId = 'earth', touch = false, tier = 'high' } = {}) {
  // Réglages du globe.
  return { tileCacheSize: tileProfile(bodyId).cache[deviceKey(touch, tier)], preloadSiblings: !touch, preloadAncestors: true };
// Fin de profileCacheOptions.
}
