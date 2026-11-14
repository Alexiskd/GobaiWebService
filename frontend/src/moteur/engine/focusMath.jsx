// Zoom par défaut quand on se téléporte sur un astre. Le zoom « N× » du HUD est la distance caméra–centre
// rapportée au rayon de l'astre : 10× = la caméra est à dix rayons du centre.

/**
 * Orbite du satellite affiché le plus éloigné de chaque planète, en rayons de la planète (demi-grand axe en km
 * divisé par le rayon utilisé par le moteur) : Lune, Deimos, Callisto, Japet, Obéron, Triton, Charon.
 * Un clic sur la planète cadre tout son système de satellites.
 */
// Déclare et exporte le rayon de l'orbite la plus éloignée de chaque planète (début de l'objet).
export const OUTER_ORBIT_RADII = {
  // La Terre.
  earth: 60.34,   // Lune : 384 400 km
  // Mars.
  mars: 6.92,     // Deimos : 23 463 km
  // Jupiter.
  jupiter: 26.36, // Callisto : 1 882 700 km
  // Saturne.
  saturn: 59.16,  // Japet : 3 561 700 km
  // Uranus.
  uranus: 22.84,  // Obéron : 583 500 km
  // Neptune.
  neptune: 14.35, // Triton : 354 760 km
  // Pluton.
  pluto: 16.49,   // Charon : 19 596 km
// Fin de l'objet.
};
/** Recul par rapport à l'orbite la plus éloignée : à 1,66 fois son rayon, elle tient dans l'écran avec une marge. */
// Facteur de recul par rapport à cette orbite.
export const ORBIT_FRAME = 1.66;

/** Zoom par défaut des planètes sans satellite ; les autres astres (Soleil, Lune, satellites) prennent DEFAULT_ZOOM. */
// Zoom par défaut de Mercure et de Vénus.
export const DEFAULT_ZOOM_BY_ID = { mercury: 6, venus: 6 };
// Zoom par défaut des autres astres.
export const DEFAULT_ZOOM = 10;

/** Zoom par défaut (en rayons de l'astre) pour l'astre d'identifiant `id`. */
// Déclare et exporte defaultZoom : reçoit l'identifiant de l'astre.
export function defaultZoom(id) {
  // Le rayon de son orbite la plus éloignée, s'il en a une.
  const outer = OUTER_ORBIT_RADII[id];
  // S'il en a une : ce rayon multiplié par le facteur de recul, arrondi.
  if (outer) return Math.round(outer * ORBIT_FRAME);
  // Sinon : son zoom propre, ou le zoom par défaut.
  return DEFAULT_ZOOM_BY_ID[id] ?? DEFAULT_ZOOM;
// Fin de defaultZoom.
}

/** Zoom « planète seule » : menu des satellites replié dans la navigation, la planète occupe la vue. */
// Zoom de la planète seule.
export const PLANET_ONLY_ZOOM = 6;

/**
 * Zoom d'une planète selon le menu de ses satellites dans la navigation :
 * déplié (`planetOnly` faux) = tout son système, cadré sur l'orbite la plus éloignée ; replié = la planète seule.
 */
// Déclare et exporte planetZoom : l'identifiant et l'indicateur « planète seule ».
export function planetZoom(id, planetOnly = false) {
  // Planète seule : le plus petit du zoom « planète seule » et du zoom par défaut ; sinon le zoom par défaut.
  return planetOnly ? Math.min(PLANET_ONLY_ZOOM, defaultZoom(id)) : defaultZoom(id);
// Fin de planetZoom.
}

/** Distance caméra–centre correspondante, dans les unités de `radius`, plafonnée à `maxDistance`. */
// Déclare et exporte defaultDistance : identifiant, rayon, distance maximale et indicateur « planète seule ».
export function defaultDistance(id, radius, maxDistance = Infinity, planetOnly = false) {
  // Le rayon (1 à défaut) multiplié par le zoom, plafonné à la distance maximale.
  return Math.min((radius || 1) * planetZoom(id, planetOnly), maxDistance);
// Fin de defaultDistance.
}
