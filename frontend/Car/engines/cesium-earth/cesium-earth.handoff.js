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

/** Le globe CesiumJS doit-il prendre la main ? */
// Déclare et exporte shouldEnter : la Terre ciblée, l'altitude, le passage armé.
export const shouldEnter = ({ earthFocused, altKm, armed }) => Boolean(earthFocused && armed && altKm < ENTER_KM);

/** Faut-il revenir à la scène three.js ? */
// Déclare et exporte shouldExit : l'altitude de la caméra du globe.
export const shouldExit = (altKm) => altKm > EXIT_KM;

/** Le passage se réarme-t-il ? Déjà armé, ou caméra three.js remontée au-dessus de REARM_KM. */
// Déclare et exporte rearm : l'état et l'altitude.
export const rearm = (armed, altKm) => armed || altKm > REARM_KM;

/** Longitude et latitude (degrés) d'une direction du repère des tuiles de la Terre (axe des pôles = +Y). */
// Déclare et exporte lonLatOf : la direction [x, y, z].
export function lonLatOf([x, y, z]) {
  // Longueur de la direction.
  const r = Math.hypot(x, y, z) || 1;
  // Longitude (même convention que mercator.jsx : −z vers l'est) et latitude.
  return { lon: (Math.atan2(-z, x) * 180) / Math.PI, lat: (Math.asin(Math.max(-1, Math.min(1, y / r))) * 180) / Math.PI };
// Fin de lonLatOf.
}
