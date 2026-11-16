// Astre dominant : parmi tous les astres, celui dont la gravité est la plus forte à l'endroit où se trouve la caméra
// (masse / distance²) — « l'astre le plus lourd le plus proche ». Près du sol de la Lune c'est la Lune, en orbite
// terrestre c'est la Terre, entre deux planètes c'est le Soleil. L'affichage donne la distance à sa surface.

/** Masses en kilogrammes (fiches NASA NSSDCA et JPL SSD, valeurs arrondies). */
// Déclare et exporte la table des masses, en kilogrammes (début de l'objet).
export const BODY_MASS_KG = {
  // Le Soleil.
  sun: 1.9885e30,
  // Mercure, Vénus, la Terre et Mars.
  mercury: 3.3011e23, venus: 4.8675e24, earth: 5.9724e24, mars: 6.4171e23,
  // Jupiter, Saturne, Uranus, Neptune et Pluton.
  jupiter: 1.8982e27, saturn: 5.6834e26, uranus: 8.681e25, neptune: 1.02413e26, pluto: 1.303e22,
  // La Lune.
  moon: 7.342e22,
  // Les quatre grandes lunes de Jupiter.
  io: 8.932e22, europa: 4.8e22, ganymede: 1.4819e23, callisto: 1.0759e23,
  // Sept lunes de Saturne.
  mimas: 3.75e19, enceladus: 1.08e20, tethys: 6.17e20, dione: 1.095e21, rhea: 2.306e21, titan: 1.3452e23, iapetus: 1.806e21,
  // Cinq lunes d'Uranus.
  miranda: 6.6e19, ariel: 1.25e21, umbriel: 1.28e21, titania: 3.4e21, oberon: 3.1e21,
  // Triton et Charon.
  triton: 2.139e22, charon: 1.586e21,
// Fin de l'objet.
};

// Rayon moyen de la Terre, en kilomètres.
export const EARTH_RADIUS_KM = 6371;

/** Masse d'un astre ; s'il n'est pas dans la table, estimation par son rayon (roche et glace, 2 000 kg/m³). */
// Déclare et exporte bodyMassKg : l'identifiant de l'astre et son rayon en kilomètres.
export function bodyMassKg(id, radiusKm) {
  // Masse connue : celle de la table.
  if (BODY_MASS_KG[id]) return BODY_MASS_KG[id];
  // Rayon en mètres, d'au moins un kilomètre.
  const r = Math.max(1, radiusKm || 1) * 1000;
  // Masse estimée : le volume de la sphère multiplié par 2 000 kg/m³.
  return (4 / 3) * Math.PI * r ** 3 * 2000;
// Fin de bodyMassKg.
}

/**
 * Astre dont la gravité domine. `bodies` : [{ massKg, distance }], distance au centre dans n'importe quelle unité
 * (la même pour tous). Renvoie l'élément gagnant, ou null si la liste est vide.
 */
// Déclare et exporte dominantBody : reçoit les astres, avec leur masse et leur distance.
export function dominantBody(bodies) {
  // Meilleur astre trouvé.
  let best = null;
  // Meilleure attraction trouvée.
  let bestPull = -1;
  // Pour chaque astre.
  for (const b of bodies) {
    // Sa distance, jamais nulle.
    const d = Math.max(b.distance, 1e-9);
    // Son attraction : la masse divisée par le carré de la distance.
    const pull = b.massKg / (d * d);
    // Plus forte que la meilleure : il la remplace.
    if (pull > bestPull) { bestPull = pull; best = b; }
  // Fin du parcours.
  }
  // Renvoie le meilleur astre.
  return best;
// Fin de dominantBody.
}

// Format français des nombres entiers.
const int = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
// dec : format français à nombre fixe de décimales.
const dec = (digits) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Distance toujours en kilomètres : deux décimales sous 10 km, une sous 100 km, puis kilomètres entiers. */
// Déclare et exporte formatDistanceKm : reçoit une distance en kilomètres.
export function formatDistanceKm(km) {
  // Jamais négative.
  const d = Math.max(0, km);
  // Sous 10 km : deux décimales.
  if (d < 10) return `${dec(2).format(d)} km`;
  // Sous 100 km : une décimale.
  if (d < 100) return `${dec(1).format(d)} km`;
  // Au-delà : kilomètres entiers.
  return `${int.format(Math.round(d))} km`;
// Fin de formatDistanceKm.
}
