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

/** Index des villes : leurs directions unitaires (x, y, z) dans un seul tableau, calculé une fois par liste. */
// Index déjà calculés, par liste de villes.
const INDEX = new WeakMap();
// Déclare et exporte cityIndex : la liste des villes (début).
export function cityIndex(cities) {
  // Déjà calculé : lui.
  let idx = INDEX.get(cities);
  // Trouvé : renvoyé.
  if (idx) return idx;
  // Trois nombres par ville (NaN pour une ville sans coordonnées lisibles).
  const xyz = new Float64Array(cities.length * 3);
  // Pour chaque ville (début).
  cities.forEach((c, i) => {
    // Coordonnées lisibles ?
    const ok = Number.isFinite(c?.lon) && Number.isFinite(c?.lat);
    // Latitude et longitude en radians.
    const la = ok ? c.lat * RAD : NaN, lo = ok ? c.lon * RAD : NaN;
    // Direction unitaire.
    xyz[i * 3] = Math.cos(la) * Math.cos(lo); xyz[i * 3 + 1] = Math.cos(la) * Math.sin(lo); xyz[i * 3 + 2] = Math.sin(la);
  // Fin de la boucle.
  });
  // Gardé et renvoyé.
  idx = { xyz }; INDEX.set(cities, idx); return idx;
// Fin de cityIndex.
}

/**
 * La ville la plus proche (et sa distance en km), ou null sans ville. La plus proche est celle dont la direction a le
 * plus grand produit scalaire avec celle du point : trois multiplications par ville, sans trigonométrie (index gardé).
 */
// Déclare et exporte nearestCity : les villes, la longitude et la latitude (degrés) (début).
export function nearestCity(cities, lon, lat) {
  // Aucune ville : rien.
  if (!Array.isArray(cities) || !cities.length) return null;
  // Directions des villes.
  const { xyz } = cityIndex(cities);
  // Direction du point.
  const la = lat * RAD, lo = lon * RAD, px = Math.cos(la) * Math.cos(lo), py = Math.cos(la) * Math.sin(lo), pz = Math.sin(la);
  // Meilleure ville et son produit scalaire.
  let best = -1, bestDot = -Infinity;
  // Pour chaque ville (début).
  for (let i = 0; i < cities.length; i++) {
    // Produit scalaire (NaN pour une ville illisible : jamais retenue).
    const d = xyz[i * 3] * px + xyz[i * 3 + 1] * py + xyz[i * 3 + 2] * pz;
    // Plus proche : gardée.
    if (d > bestDot) { bestDot = d; best = i; }
  // Fin de la boucle.
  }
  // Aucune lisible : rien.
  if (best < 0) return null;
  // Renvoie la ville et sa distance exacte.
  const city = cities[best];
  // Distance sur la sphère.
  return { city, km: distanceKm(lon, lat, city.lon, city.lat) };
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
