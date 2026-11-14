/**
 * Passerelle entre le calcul des orbites et la scène 3D.
 *
 * Tout le calcul (positions, vitesses, orbites, Lune, échelles de temps) est dans `planetOrbits.jsx`, qui ne
 * dépend d'aucune bibliothèque : il est ainsi testable hors navigateur. Ce fichier n'ajoute que les quelques
 * conversions en vecteurs Three.js, et réexporte le reste pour ne pas changer les imports du moteur.
 */
// Bibliothèque 3D.
import * as THREE from 'three';
// Le calcul des orbites, sans dépendance.
import { AU_UNITS, D } from './planetOrbits';

// Réexporte le calcul des orbites : les appelants importent tout depuis ce fichier, comme avant.
export {
  // Constantes.
  D, AU_KM, AU_UNITS, TT_MINUS_UTC_S, MOON_EQUATOR_TILT_DEG, MOON_BARYCENTRE_SHARE,
  // Échelles de temps.
  centuriesTT, julianDayTT,
  // Positions, vitesses et orbites des planètes.
  solveKepler, elementsAt, heliocentric, heliocentricEcliptic, heliocentricState, orbitPositions,
  // Lune, et centre de la Terre par rapport au barycentre Terre–Lune.
  moonGeocentric, earthOffsetFromBarycentre, earthPosition,
// Fin des réexports.
} from './planetOrbits';

/** Rayon terrestre moyen (km). */
const EARTH_RADIUS_KM = 6371;
/** Sinus et cosinus d'un angle en degrés. */
const sd = (deg) => Math.sin(deg * D);
const cd = (deg) => Math.cos(deg * D);

/** Position héliocentrique (UA, repère de la scène) → vecteur de la scène, en unités de scène. */
export const toScene = (p) => new THREE.Vector3(p[0] * AU_UNITS, p[1] * AU_UNITS, p[2] * AU_UNITS);

/** Direction d'une longitude et d'une latitude écliptiques (degrés) → vecteur unité du repère de la scène. */
export function lonLatToVec([lon, lat]) {
  // Angles en radians.
  const lo = lon * D, la = lat * D;
  // Le vecteur unité.
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
// Fin de lonLatToVec.
}

/** Vecteur Terre → Lune dans le repère de la scène (rayons terrestres), même convention que `heliocentric`. */
export function moonToScene({ lon, lat, distKm }, out = new THREE.Vector3()) {
  // Distance en rayons terrestres.
  const r = distKm / EARTH_RADIUS_KM;
  // Le vecteur.
  return out.set(r * cd(lat) * cd(lon), r * sd(lat), -r * cd(lat) * sd(lon));
// Fin de moonToScene.
}
