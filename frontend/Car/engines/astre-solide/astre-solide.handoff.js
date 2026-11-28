/**
 * Passage entre la scène three.js (système solaire) et le globe CesiumJS (la Terre de près). Fonctions pures.
 *
 * La Terre ciblée, la caméra sous ENTER_KM d'altitude : le globe CesiumJS prend la main au même endroit. Dans le
 * globe, la caméra au-dessus de EXIT_KM : retour à la scène three.js au même endroit, au-dessus de RETURN_KM. Le
 * passage ne se réarme qu'une fois la caméra three.js remontée au-dessus de REARM_KM (pas d'aller-retour en boucle).
 */

// Altitude (km) sous laquelle le globe CesiumJS prend la main.
export const ENTER_KM = 20000;
// Altitude (km) au-dessus de laquelle l'ombre et la pollution lumineuse sont pleines (≈ 6 rayons) ; elles baissent
// ensuite en fondu jusqu'à ENTER_KM, où le globe prend la main sans ombre ni lumières de la nuit.
export const FADE_KM = 38000;
// Altitude (km) du globe CesiumJS au-dessus de laquelle on revient à la scène three.js.
export const EXIT_KM = 30000;
// Altitude (km) de la caméra three.js au retour.
export const RETURN_KM = 32000;
// Altitude (km) de la caméra three.js qui réarme le passage.
export const REARM_KM = 24000;

/** Altitude de la caméra (km) d'après sa distance au centre de la Terre et le rayon (mêmes unités). */
// Déclare et exporte altitudeKm : la distance, le rayon et le rayon réel en km.
export const altitudeKm = (dist, radius, radiusKm = 6371) => (dist / radius - 1) * radiusKm;

/**
 * Rayon de la Terre (km) : les altitudes ci-dessus sont celles de la Terre. Pour un autre astre solide, elles sont
 * ramenées à son rayon (même nombre de rayons : 20 000 km sur la Terre = 3,14 rayons, soit 5 455 km sur la Lune).
 */
// Déclare et exporte le rayon de la Terre en km.
export const EARTH_RADIUS_KM = 6371;

/** Altitude de la Terre (km) ramenée à un astre de rayon `radiusKm` : même nombre de rayons. */
// Déclare et exporte scaledKm : l'altitude terrestre et le rayon de l'astre (km).
export const scaledKm = (km, radiusKm = EARTH_RADIUS_KM) => (km * radiusKm) / EARTH_RADIUS_KM;

/** Fondu du zoom : 1 au-dessus de FADE_KM, 0 à ENTER_KM et dessous, linéaire entre les deux (altitudes de l'astre). */
// Déclare et exporte zoomFade : l'altitude (km) et le rayon de l'astre (km).
export const zoomFade = (altKm, radiusKm = EARTH_RADIUS_KM) => {
  // Altitudes du début et de la fin du fondu, ramenées à l'astre.
  const lo = scaledKm(ENTER_KM, radiusKm), hi = scaledKm(FADE_KM, radiusKm);
  // Altitude inconnue : pas de fondu.
  if (!Number.isFinite(altKm)) return 1;
  // Part restante, entre 0 et 1.
  return Math.min(1, Math.max(0, (altKm - lo) / (hi - lo)));
};

/** Le globe CesiumJS doit-il prendre la main ? Astre ciblé, passage armé, caméra sous l'altitude d'entrée. */
// Déclare et exporte shouldEnter : l'astre ciblé, l'altitude, le passage armé et le rayon de l'astre (km).
export const shouldEnter = ({ earthFocused, focused = earthFocused, altKm, armed, radiusKm = EARTH_RADIUS_KM }) => Boolean(focused && armed && altKm < scaledKm(ENTER_KM, radiusKm));

/** Faut-il revenir à la scène three.js ? */
// Déclare et exporte shouldExit : l'altitude de la caméra du globe et le rayon de l'astre (km).
export const shouldExit = (altKm, radiusKm = EARTH_RADIUS_KM) => altKm > scaledKm(EXIT_KM, radiusKm);

/** Le passage se réarme-t-il ? Déjà armé, ou caméra three.js remontée au-dessus de l'altitude de réarmement. */
// Déclare et exporte rearm : l'état, l'altitude et le rayon de l'astre (km).
export const rearm = (armed, altKm, radiusKm = EARTH_RADIUS_KM) => armed || altKm > scaledKm(REARM_KM, radiusKm);

/** Longitude et latitude (degrés) d'une direction du repère des tuiles de la Terre (axe des pôles = +Y). */
// Déclare et exporte lonLatOf : la direction [x, y, z].
export function lonLatOf([x, y, z]) {
  // Longueur de la direction.
  const r = Math.hypot(x, y, z) || 1;
  // Longitude (même convention que mercator.jsx : −z vers l'est) et latitude.
  return { lon: (Math.atan2(-z, x) * 180) / Math.PI, lat: (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI };
// Fin de lonLatOf.
}

/**
 * Relief au zoom : part du relief affichée selon l'altitude de la caméra. Aucun relief de loin (au-dessus de
 * RELIEF_FAR_RADII rayons d'altitude), relief complet de près (sous RELIEF_NEAR_RADII), fondu en S entre les deux.
 * Terre : plein sous ≈ 255 km, rien au-dessus de ≈ 1 600 km ; Lune : plein sous ≈ 70 km, rien au-dessus de ≈ 430 km.
 * Le résultat est arrondi au 1/50 : CesiumJS ne recalcule les volumes des tuiles qu'à un vrai changement.
 */
// Déclare et exporte les altitudes du fondu du relief (en rayons de l'astre).
export const RELIEF_NEAR_RADII = 0.04;
// Déclare et exporte l'altitude au-dessus de laquelle le relief est absent (en rayons).
export const RELIEF_FAR_RADII = 0.25;
// Déclare et exporte reliefRamp : l'altitude (km) et le rayon de l'astre (km) (début).
export function reliefRamp(altKm, radiusKm) {
  // Rayon illisible : relief complet ; altitude pas encore connue : pas de relief (il apparaîtra en approchant).
  if (!(radiusKm > 0)) return 1;
  if (!Number.isFinite(altKm)) return 0;
  // Altitude en rayons.
  const a = altKm / radiusKm;
  // Position dans le fondu : 0 de loin, 1 de près.
  const t = Math.min(1, Math.max(0, (RELIEF_FAR_RADII - a) / (RELIEF_FAR_RADII - RELIEF_NEAR_RADII)));
  // Courbe en S, arrondie au 1/50.
  return Math.round(t * t * (3 - 2 * t) * 50) / 50;
// Fin de reliefRamp.
}

