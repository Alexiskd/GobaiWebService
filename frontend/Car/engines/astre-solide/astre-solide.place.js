/**
 * Nom du lieu sous la caméra du globe (Terre), pour le HUD : la ville la plus proche du point visé, parmi les villes
 * Natural Earth déjà chargées pour les étiquettes (aucun appel réseau de plus). La précision suit l'altitude : le pays
 * de haut, puis la région, puis la ville. Fonctions pures.
 */

// Rayon de la Terre (km).
const R_KM = 6371;
// Radians par degré.
const RAD = Math.PI / 180;

/** Altitude (km) au-dessus de laquelle seul le pays est donné. */
// Déclare et exporte le seuil du pays.
export const COUNTRY_ABOVE_KM = 1500;
/** Altitude (km) au-dessus de laquelle la région et le pays sont donnés (dessous : la ville en plus). */
// Déclare et exporte le seuil de la région.
export const REGION_ABOVE_KM = 150;
/** Distance (km) au-delà de laquelle aucune ville n'est assez proche : en mer ou dans un désert, rien n'est donné. */
// Déclare et exporte la distance maximale.
export const FAR_KM = 600;

/** Distance (km) sur la sphère entre deux points (degrés). */
// Déclare et exporte distanceKm : les deux longitudes et latitudes (début).
export function distanceKm(lon1, lat1, lon2, lat2) {
  // Écarts en radians.
  const dLat = (lat2 - lat1) * RAD, dLon = (lon2 - lon1) * RAD;
  // Formule de haversine.
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2;
  // Distance.
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
// Fin de distanceKm.
}

/** La ville la plus proche (et sa distance en km), ou null sans ville. */
// Déclare et exporte nearestCity : les villes, la longitude et la latitude (degrés) (début).
export function nearestCity(cities, lon, lat) {
  // Meilleure ville et sa distance.
  let best = null, bestKm = Infinity;
  // Pour chaque ville aux coordonnées lisibles.
  for (const c of cities ?? []) {
    // Coordonnées illisibles : ignorée.
    if (!Number.isFinite(c?.lon) || !Number.isFinite(c?.lat)) continue;
    // Distance au point.
    const d = distanceKm(lon, lat, c.lon, c.lat);
    // Plus proche : gardée.
    if (d < bestKm) { best = c; bestKm = d; }
  // Fin de la boucle.
  }
  // Renvoie la ville et sa distance.
  return best ? { city: best, km: bestKm } : null;
// Fin de nearestCity.
}

/**
 * Texte du lieu sous la caméra : « Pays » de haut, « Région · Pays » plus bas, « Ville · Région · Pays » près du
 * sol (noms français quand ils existent). Chaîne vide sans ville proche.
 */
// Déclare et exporte placeText : les villes, le point visé (degrés) et l'altitude (km) (début).
export function placeText(cities, lon, lat, altKm) {
  // Ville la plus proche.
  const near = nearestCity(cities, lon, lat);
  // Aucune, ou trop loin : rien.
  if (!near || near.km > FAR_KM) return '';
  // La ville, son pays et sa région.
  const c = near.city, country = c.countryFr || c.country || '', region = c.region || '';
  // Ville : seulement près du sol et si elle est assez proche pour l'altitude (au moins 25 km, ou l'altitude).
  const city = altKm < REGION_ABOVE_KM && near.km <= Math.max(25, altKm) ? (c.nameFr || c.name || '') : '';
  // Parties retenues selon l'altitude, sans doublon (ville-État, région du même nom que la ville).
  const parts = altKm >= COUNTRY_ABOVE_KM ? [country] : [city, region, country];
  // Texte : parties non vides, sans répétition.
  return parts.filter((p, i) => p && parts.indexOf(p) === i).join(' · ');
// Fin de placeText.
}
