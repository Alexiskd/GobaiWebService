import * as THREE from 'three';

/** Degrés → radians. */
export const D = Math.PI / 180;

// 1 UA exprimée en rayons terrestres (échelle réelle 1:1).
export const AU_UNITS = 23455;

// Position héliocentrique (UA) à T siècles depuis J2000, dans le repère de la scène.
// Même calcul que le service NestJS (`EphemerisService.heliocentric`) : le front le garde
// en local pour animer à 60 images/s sans aller-retour réseau.
export function heliocentric(el, T, meanAnomalyDeg) {
  const a = el[0] + el[1] * T;
  const e = el[2] + el[3] * T;
  const I = (el[4] + el[5] * T) * D;
  const L = el[6] + el[7] * T;
  const wp = el[8] + el[9] * T;
  const Om = (el[10] + el[11] * T) * D;

  let M = (meanAnomalyDeg === undefined ? L - wp : meanAnomalyDeg) * D;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  let E = M;
  for (let i = 0; i < 8; i++) E = M + e * Math.sin(E);

  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const w = wp * D - Om;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(Om), sO = Math.sin(Om);
  const cI = Math.cos(I), sI = Math.sin(I);
  const xe = (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp;
  const ye = (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp;
  const ze = sw * sI * xp + cw * sI * yp;
  return [xe, ze, -ye];
}

export const toScene = (p) => new THREE.Vector3(p[0] * AU_UNITS, p[1] * AU_UNITS, p[2] * AU_UNITS);

// [longitude, latitude] en degrés → vecteur unitaire sur la sphère terrestre.
export function lonLatToVec([lon, lat]) {
  const lo = lon * D, la = lat * D;
  return new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

// ------------------------------------------------------------------ Lune

const EARTH_RADIUS_KM = 6371;
const PRECESSION_DEG_PER_CENTURY = 1.3969713; // écliptique de la date → écliptique J2000 (repère des planètes)
const sd = (deg) => Math.sin(deg * D);
const cd = (deg) => Math.cos(deg * D);

/**
 * Position géocentrique de la Lune à T siècles depuis J2000 : termes principaux de la théorie ELP
 * (J. Meeus, « Astronomical Algorithms », chap. 47). Précision ≈ 0,05° en longitude, ≈ 300 km en distance.
 * Angles en degrés, rapportés à l'écliptique J2000 comme les planètes.
 *  lon, lat   longitude et latitude écliptiques vraies
 *  distKm     distance centre à centre
 *  meanLon    longitude moyenne L' (sert à l'orientation : la Lune tourne uniformément)
 *  node       longitude du nœud ascendant de l'orbite Ω
 */
export function moonGeocentric(T) {
  const Lp = 218.3164477 + 481267.88123421 * T;
  const Dm = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const Om = 125.04452 - 1934.136261 * T;

  const lon = Lp
    + 6.288774 * sd(Mp) + 1.274027 * sd(2 * Dm - Mp) + 0.658314 * sd(2 * Dm) + 0.213618 * sd(2 * Mp)
    - 0.185116 * sd(M) - 0.114332 * sd(2 * F) + 0.058793 * sd(2 * Dm - 2 * Mp) + 0.057066 * sd(2 * Dm - M - Mp)
    + 0.053322 * sd(2 * Dm + Mp) + 0.045758 * sd(2 * Dm - M) - 0.040923 * sd(M - Mp) - 0.03472 * sd(Dm)
    - 0.030383 * sd(M + Mp);
  const lat = 5.128122 * sd(F) + 0.280602 * sd(Mp + F) + 0.277693 * sd(Mp - F) + 0.173237 * sd(2 * Dm - F)
    + 0.055413 * sd(2 * Dm - Mp + F) + 0.046271 * sd(2 * Dm - Mp - F) + 0.032573 * sd(2 * Dm + F)
    + 0.017198 * sd(2 * Mp + F);
  const distKm = 385000.56
    - 20905.355 * cd(Mp) - 3699.111 * cd(2 * Dm - Mp) - 2955.968 * cd(2 * Dm) - 569.925 * cd(2 * Mp)
    + 48.888 * cd(M) + 246.158 * cd(2 * Dm - 2 * Mp) - 152.138 * cd(2 * Dm - M - Mp) - 170.733 * cd(2 * Dm + Mp)
    - 204.586 * cd(2 * Dm - M) - 129.62 * cd(M - Mp) + 108.743 * cd(Dm) + 104.755 * cd(M + Mp);

  const p = PRECESSION_DEG_PER_CENTURY * T;
  return { lon: lon - p, lat, distKm, meanLon: Lp - p, node: Om - p };
}

/** Vecteur Terre → Lune dans le repère de la scène (rayons terrestres), même convention que `heliocentric`. */
export function moonToScene({ lon, lat, distKm }, out = new THREE.Vector3()) {
  const r = distKm / EARTH_RADIUS_KM;
  return out.set(r * cd(lat) * cd(lon), r * sd(lat), -r * cd(lat) * sd(lon));
}

/** Inclinaison de l'équateur lunaire sur l'écliptique (lois de Cassini). */
export const MOON_EQUATOR_TILT_DEG = 1.5427;
