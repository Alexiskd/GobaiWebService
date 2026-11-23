/**
 * Passage entre la scène three.js (système solaire) et le globe CesiumJS (la Terre de près). Fonctions pures.
 *
 * La Terre ciblée, la caméra sous ENTER_KM d'altitude : le globe CesiumJS prend la main au même endroit. Dans le
 * globe, la caméra au-dessus de EXIT_KM : retour à la scène three.js au même endroit, au-dessus de RETURN_KM. Le
 * passage ne se réarme qu'une fois la caméra three.js remontée au-dessus de REARM_KM (pas d'aller-retour en boucle).
 */

// Altitude (km) sous laquelle le globe CesiumJS prend la main.
export const ENTER_KM = 20000;
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
