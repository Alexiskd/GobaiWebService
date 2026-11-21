/**
 * Orbites des planètes et position de la Lune : calcul local, sans aucun appel à un service d'éphémérides.
 *
 * Méthode : VSOP87A complet pour les huit planètes (positions et vitesses analytiques), Kepler comme repli
 * pour les corps sans série publiée dans ce dépôt, et termes principaux ELP pour la Lune. Calcul local, sans
 * requête réseau à chaque image de rendu.
 *
 * Ce module est le pendant serveur de frontend/src/moteur/engine/planetOrbits.jsx : mêmes formules, mêmes
 * constantes, mêmes repères. Les deux sont vérifiés sur le même vecteur d'état de référence de Mars.
 *
 * Repères : écliptique J2000, x vers l'équinoxe de mars, z vers le pôle nord de l'écliptique. Le repère de la
 * scène 3D, (x, z, −y), n'apparaît que du côté du navigateur.
 */

/** Degrés → radians. */
import { vsop87aState, osculatingElements } from './vsop87a';

const D = Math.PI / 180;
/** Unité astronomique (km), définition UAI 2012. */
export const AU_KM = 149_597_870.7;
/** Jour julien de l'époque Unix. */
export const UNIX_EPOCH_JD = 2_440_587.5;
/** Jour julien de J2000.0. */
export const J2000_JD = 2_451_545;
/** Millisecondes dans un jour. */
const DAY_MS = 86_400_000;

/**
 * Temps terrestre moins UTC, en secondes : TT = TAI + 32,184 s et TAI − UTC = 37 s depuis le 1er janvier 2017.
 * Le TDB des éphémérides s'écarte du TT de moins de 2 millisecondes, négligeable ici.
 */
export const TT_MINUS_UTC_S = 69.184;

/**
 * Siècles juliens de Temps terrestre écoulés depuis J2000.0, à partir d'un instant UTC en millisecondes.
 * Les deux jours juliens sont soustraits avant d'ajouter l'écart TT − UTC, pour ne pas perdre celui-ci dans
 * l'arrondi d'un flottant de l'ordre de 2 461 000.
 */
export const centuriesTT = (ms: number): number => (ms / DAY_MS + (UNIX_EPOCH_JD - J2000_JD) + TT_MINUS_UTC_S / 86_400) / 36_525;

/** Jour julien (UTC) d'un instant en millisecondes. */
export const julianDay = (ms: number): number => ms / DAY_MS + UNIX_EPOCH_JD;

/** Un vecteur de l'écliptique J2000. */
export type Vec3 = [number, number, number];

/**
 * Équation de Kepler M = E − e·sin E, résolue par la méthode de Newton.
 * Le point de départ E₀ = M + 0,85·e·signe(M) (Danby) évite la divergence près de M = ±π pour les fortes
 * excentricités ; la correction est bornée à un radian par tour. Résidu mesuré : 9 × 10⁻¹⁶ jusqu'à e = 0,99.
 */
export function solveKepler(M: number, e: number): number {
  // Anomalie moyenne ramenée dans [-π, π].
  const m = Math.atan2(Math.sin(M), Math.cos(M));
  // Point de départ, décalé vers le périastre.
  let E = m + 0.85 * e * Math.sign(m || 1);
  // Itérations de Newton.
  for (let i = 0; i < 40; i++) {
    // Correction bornée.
    const d = Math.max(-1, Math.min(1, (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E))));
    // Nouvelle estimation.
    E -= d;
    // Convergée.
    if (Math.abs(d) < 1e-14) break;
  // Fin des itérations.
  }
  // L'anomalie excentrique.
  return E;
}

/** Les six éléments d'une planète à T siècles de J2000, et son moyen mouvement (rad/jour). */
export interface ElementsAt { a: number; e: number; I: number; L: number; varpi: number; Om: number; n: number }

/**
 * Éléments à la date, d'après les douze nombres de la table
 * [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω'] (a en UA, angles en degrés, dérives par siècle julien).
 */
export function elementsAt(el: readonly number[], T: number): ElementsAt {
  // Chaque élément, plus sa dérive.
  return {
    a: el[0] + el[1] * T,
    e: el[2] + el[3] * T,
    I: (el[4] + el[5] * T) * D,
    L: el[6] + el[7] * T,
    varpi: el[8] + el[9] * T,
    Om: (el[10] + el[11] * T) * D,
    // Moyen mouvement ajusté sur les observations, tiré de la dérive de la longitude moyenne.
    n: (el[7] * D) / 36_525,
  };
// Fin de elementsAt.
}

// Rotation du plan de l'orbite vers l'écliptique : applique ω, I puis Ω à un couple (x, y) du plan orbital.
function rotate(k: ElementsAt, x: number, y: number): Vec3 {
  // Argument du périhélie.
  const w = k.varpi * D - k.Om;
  // Cosinus et sinus des trois angles.
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(k.Om), sO = Math.sin(k.Om);
  const cI = Math.cos(k.I), sI = Math.sin(k.I);
  // Le vecteur dans l'écliptique J2000.
  return [
    (cw * cO - sw * sO * cI) * x + (-sw * cO - cw * sO * cI) * y,
    (cw * sO + sw * cO * cI) * x + (-sw * sO + cw * cO * cI) * y,
    sw * sI * x + cw * sI * y,
  ];
// Fin de rotate.
}

/** Position héliocentrique dans l'écliptique J2000 (UA) à T siècles de J2000. */
export function heliocentric(el: readonly number[], T: number): Vec3 {
  // Série VSOP87A disponible pour les huit planètes.
  const precise = vsop87aState(el, T);
  if (precise) return precise.position;
  // Repli képlérien pour les corps sans série VSOP87A.
  const k = elementsAt(el, T);
  // Anomalie excentrique.
  const E = solveKepler((k.L - k.varpi) * D, k.e);
  // Position dans le plan de l'orbite, tournée vers l'écliptique.
  return rotate(k, k.a * (Math.cos(E) - k.e), k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E));
// Fin de heliocentric.
}

/** Position (UA) et vitesse (UA/jour) héliocentriques, écliptique J2000. La vitesse est dérivée analytiquement. */
export function heliocentricState(el: readonly number[], T: number): { position: Vec3; velocity: Vec3 } {
  // Position et dérivée temporelle VSOP87A, évaluées directement.
  const precise = vsop87aState(el, T);
  if (precise) return precise;
  // Repli képlérien.
  const k = elementsAt(el, T);
  // Anomalie excentrique et ses fonctions.
  const E = solveKepler((k.L - k.varpi) * D, k.e);
  const cE = Math.cos(E), sE = Math.sin(E), b = Math.sqrt(1 - k.e * k.e);
  // Facteur de la vitesse : a·n / (1 − e·cos E), avec dE/dt = n / (1 − e·cos E).
  const f = (k.a * k.n) / (1 - k.e * cE);
  // Position et vitesse.
  return {
    position: rotate(k, k.a * (cE - k.e), k.a * b * sE),
    velocity: rotate(k, -f * sE, f * b * cE),
  };
// Fin de heliocentricState.
}

/** Précession de l'écliptique de la date vers l'écliptique J2000, en degrés par siècle. */
const PRECESSION_DEG_PER_CENTURY = 1.3969713;
/** Sinus et cosinus d'un angle en degrés. */
const sd = (deg: number) => Math.sin(deg * D);
const cd = (deg: number) => Math.cos(deg * D);

/** Position géocentrique de la Lune : longitude et latitude écliptiques (degrés) et distance (km). */
export interface MoonPosition { lon: number; lat: number; distKm: number; meanLon: number; node: number }

/**
 * Position géocentrique de la Lune à T siècles depuis J2000 : termes principaux de la théorie ELP
 * (J. Meeus, « Astronomical Algorithms », chap. 47). Précision ≈ 0,05° en longitude, ≈ 300 km en distance.
 *
 * La Lune est trop perturbée pour une ellipse képlérienne : l'évection vaut 1,27° et la variation 0,66°, soit
 * plus de dix mille kilomètres — d'où ces termes périodiques, qui les reprennent un à un.
 * Angles rapportés à l'écliptique J2000, comme les planètes.
 */
export function moonGeocentric(T: number): MoonPosition {
  // Arguments fondamentaux : longitude moyenne, élongation, anomalies du Soleil et de la Lune, argument de latitude.
  const Lp = 218.3164477 + 481267.88123421 * T;
  const Dm = 297.8501921 + 445267.1114034 * T;
  const M = 357.5291092 + 35999.0502909 * T;
  const Mp = 134.9633964 + 477198.8675055 * T;
  const F = 93.272095 + 483202.0175233 * T;
  const Om = 125.04452 - 1934.136261 * T;

  // Longitude écliptique vraie.
  const lon = Lp
    + 6.288774 * sd(Mp) + 1.274027 * sd(2 * Dm - Mp) + 0.658314 * sd(2 * Dm) + 0.213618 * sd(2 * Mp)
    - 0.185116 * sd(M) - 0.114332 * sd(2 * F) + 0.058793 * sd(2 * Dm - 2 * Mp) + 0.057066 * sd(2 * Dm - M - Mp)
    + 0.053322 * sd(2 * Dm + Mp) + 0.045758 * sd(2 * Dm - M) - 0.040923 * sd(M - Mp) - 0.03472 * sd(Dm)
    - 0.030383 * sd(M + Mp);
  // Latitude écliptique.
  const lat = 5.128122 * sd(F) + 0.280602 * sd(Mp + F) + 0.277693 * sd(Mp - F) + 0.173237 * sd(2 * Dm - F)
    + 0.055413 * sd(2 * Dm - Mp + F) + 0.046271 * sd(2 * Dm - Mp - F) + 0.032573 * sd(2 * Dm + F)
    + 0.017198 * sd(2 * Mp + F);
  // Distance centre à centre.
  const distKm = 385000.56
    - 20905.355 * cd(Mp) - 3699.111 * cd(2 * Dm - Mp) - 2955.968 * cd(2 * Dm) - 569.925 * cd(2 * Mp)
    + 48.888 * cd(M) + 246.158 * cd(2 * Dm - 2 * Mp) - 152.138 * cd(2 * Dm - M - Mp) - 170.733 * cd(2 * Dm + Mp)
    - 204.586 * cd(2 * Dm - M) - 129.62 * cd(M - Mp) + 108.743 * cd(Dm) + 104.755 * cd(M + Mp);

  // Précession, pour rapporter le tout à l'écliptique J2000.
  const p = PRECESSION_DEG_PER_CENTURY * T;
  // La position.
  return { lon: lon - p, lat, distKm, meanLon: Lp - p, node: Om - p };
// Fin de moonGeocentric.
}

/** Vecteur Terre → Lune dans l'écliptique J2000, en kilomètres. */
export function moonVector(T: number): Vec3 {
  // La position de la Lune.
  const { lon, lat, distKm } = moonGeocentric(T);
  // En coordonnées cartésiennes.
  return [distKm * cd(lat) * cd(lon), distKm * cd(lat) * sd(lon), distKm * sd(lat)];
// Fin de moonVector.
}

/** Part de la Lune dans le barycentre Terre–Lune : m_Lune / (m_Terre + m_Lune) = 1 / (1 + 81,30056). */
export const MOON_BARYCENTRE_SHARE = 1 / (1 + 81.30056);

/**
 * Position héliocentrique du centre de la Terre (UA). VSOP87A EARTH décrit directement le centre de la Terre ;
 * la correction barycentrique ci-dessous n'est conservée que pour le repli képlérien.
 */
export function earthPosition(el: readonly number[], T: number): Vec3 {
  // VSOP87A EARTH décrit directement le centre de la Terre, contrairement à la ligne EMB de la théorie elliptique.
  const precise = vsop87aState(el, T);
  if (precise) return precise.position;
  // Ancienne table de repli : position du barycentre Terre–Lune.
  const b = heliocentric(el, T);
  // Vecteur Terre → Lune, en UA.
  const m = moonVector(T);
  // Le centre de la Terre est à l'opposé de la Lune, au prorata des masses.
  return [0, 1, 2].map((i) => b[i] - (MOON_BARYCENTRE_SHARE * m[i]) / AU_KM) as Vec3;
// Fin de earthPosition.
}

// Éléments osculateurs issus d'un état VSOP87A (pour les exports d'orbites).
export { osculatingElements };
