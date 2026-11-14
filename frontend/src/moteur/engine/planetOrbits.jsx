/**
 * Orbites des planètes : calcul local, sans aucun appel réseau.
 *
 * Méthode nominale : séries rectangulaires complètes VSOP87A pour les huit planètes, évaluées localement avec
 * dérivation analytique des vitesses. Kepler reste le repli pour les corps sans série VSOP87A (dont Pluton) ;
 * la Lune conserve les termes périodiques ELP. Aucun appel réseau par image de rendu.
 *
 * Éléments : table « Keplerian Elements for Approximate Positions of the Major Planets », valable de 1800 à 2050,
 * rangée dans backend/src/services/data/bodies.data.ts sous la forme
 *   [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω']   (a en UA, angles en degrés, dérives par siècle julien).
 * Ce sont des données statiques versionnées dans le dépôt, pas un service interrogé à l'exécution.
 *
 * Contrôle indépendant : sur Mars au 1er janvier 2026, écart de 7 708 km et 1,21 m/s face au vecteur de référence
 * JPL figé dans planetOrbits.test.jsx. VSOP87A est une théorie analytique ajustée à DE200, pas une éphéméride DE440/DE441.
 * Les échelles de temps comptent : les éléments sont rapportés au Temps terrestre, pas à UTC (§ 4.B).
 *
 * Repères. Deux conventions cohabitent et ne doivent pas être confondues :
 *  - écliptique J2000 « mathématique » : (x, y, z), x vers l'équinoxe de mars, z vers le pôle nord de l'écliptique ;
 *  - repère de la scène 3D : (x, z, −y) de la précédente, parce que Three.js dessine la verticale en y.
 * Les fonctions dont le nom finit par `Ecliptic` rendent la première ; les autres rendent celle de la scène.
 */

import { vsop87aState, osculatingOrbitPositions } from '../../../../backend/src/services/ephemeris/vsop87a';

/** Degrés → radians. */
export const D = Math.PI / 180;
/** Unité astronomique (km), définition UAI 2012. */
export const AU_KM = 149_597_870.7;
/** Une unité astronomique vaut 23 455 unités de scène (la scène compte en rayons terrestres). */
export const AU_UNITS = 23455;
/** Jour julien de l'époque Unix. */
const UNIX_EPOCH_JD = 2_440_587.5;
/** Jour julien de J2000.0. */
const J2000_JD = 2_451_545;
/** Millisecondes dans un jour. */
const DAY_MS = 86_400_000;

/**
 * Temps terrestre moins UTC, en secondes : TT = TAI + 32,184 s et TAI − UTC = 37 s depuis le 1er janvier 2017.
 * Le TDB des éphémérides s'écarte du TT de moins de 2 millisecondes, négligeable ici.
 * Une seconde intercalaire décidée plus tard changerait ce nombre de 1 s, soit 30 km sur la Terre.
 */
export const TT_MINUS_UTC_S = 69.184;

/**
 * Siècles juliens de Temps terrestre écoulés depuis J2000.0, à partir d'un instant UTC en millisecondes.
 * Les deux jours juliens sont soustraits avant d'ajouter l'écart TT − UTC : sans cela, ajouter 8 × 10⁻⁴ jour à
 * un nombre de l'ordre de 2 461 000 perdrait une partie du décalage dans l'arrondi du flottant.
 */
export const centuriesTT = (ms) => (ms / DAY_MS + (UNIX_EPOCH_JD - J2000_JD) + TT_MINUS_UTC_S / 86_400) / 36_525;

/** Jour julien de Temps terrestre d'un instant UTC en millisecondes. */
export const julianDayTT = (ms) => ms / DAY_MS + TT_MINUS_UTC_S / 86_400 + UNIX_EPOCH_JD;

/**
 * Équation de Kepler M = E − e·sin E, résolue par la méthode de Newton.
 *
 * Le point de départ E₀ = M + 0,85·e·signe(M) (Danby) place l'estimation du bon côté du périastre : sans lui,
 * une orbite très excentrique fait diverger Newton près de M = ±π, là où la dérivée 1 − e·cos E s'approche de zéro.
 * La précision machine est atteinte en trois ou quatre tours pour les planètes ; la correction est bornée à un
 * radian par tour, ce qui garantit la convergence jusqu'aux excentricités cométaires.
 */
export function solveKepler(M, e) {
  // Anomalie moyenne ramenée dans [-π, π].
  const m = Math.atan2(Math.sin(M), Math.cos(M));
  // Point de départ, décalé vers le périastre pour les orbites excentriques.
  let E = m + 0.85 * e * Math.sign(m || 1);
  // Itérations de Newton.
  for (let i = 0; i < 40; i++) {
    // Correction : f(E)/f'(E), bornée à un radian pour ne pas sauter hors du bassin de convergence.
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

/** Éléments d'une planète à T siècles de J2000 : chaque élément plus sa dérive séculaire. */
export function elementsAt(el, T) {
  // Les six éléments à la date voulue.
  return {
    a: el[0] + el[1] * T,
    e: el[2] + el[3] * T,
    I: (el[4] + el[5] * T) * D,
    L: el[6] + el[7] * T,
    varpi: el[8] + el[9] * T,
    Om: (el[10] + el[11] * T) * D,
    // Moyen mouvement ajusté sur les observations (rad/jour), tiré de la dérive de la longitude moyenne.
    n: (el[7] * D) / 36_525,
  };
// Fin de elementsAt.
}

// Rotation du plan de l'orbite vers l'écliptique : applique ω, I puis Ω à un couple (x, y) du plan orbital.
function rotate(k, x, y) {
  // Argument du périhélie : longitude du périhélie moins longitude du nœud.
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

/**
 * Position héliocentrique dans l'écliptique J2000 (UA) à T siècles de J2000.
 * `meanAnomalyDeg` force l'anomalie moyenne (tracé d'orbite, recherche d'équinoxe) au lieu de L − ϖ.
 */
export function heliocentricEcliptic(el, T, meanAnomalyDeg) {
  // VSOP87A est le modèle nominal ; une anomalie imposée conserve le chemin képlérien pour les cas pédagogiques.
  if (meanAnomalyDeg === undefined) {
    const precise = vsop87aState(el, T);
    if (precise) return precise.position;
  }
  // Éléments à la date.
  const k = elementsAt(el, T);
  // Anomalie excentrique.
  const E = solveKepler((meanAnomalyDeg === undefined ? k.L - k.varpi : meanAnomalyDeg) * D, k.e);
  // Position dans le plan de l'orbite, périhélie sur l'axe des x.
  return rotate(k, k.a * (Math.cos(E) - k.e), k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E));
// Fin de heliocentricEcliptic.
}

/** Même position, dans le repère de la scène (x, z, −y). Signature inchangée depuis l'origine du projet. */
export function heliocentric(el, T, meanAnomalyDeg) {
  // Position écliptique.
  const [x, y, z] = heliocentricEcliptic(el, T, meanAnomalyDeg);
  // Convertie dans le repère de la scène.
  return [x, z, -y];
// Fin de heliocentric.
}

/**
 * État complet d'une planète : position (UA) et vitesse (UA/jour) héliocentriques, écliptique J2000.
 * La vitesse est dérivée analytiquement de la solution de Kepler (dE/dt = n / (1 − e·cos E)), pas par
 * différences finies. Elle sert au contrat de données de l'API (§ 6 du dossier) et aux vitesses affichées.
 */
export function heliocentricState(el, T) {
  // Position et vitesse analytiques du modèle VSOP87A.
  const precise = vsop87aState(el, T);
  if (precise) return precise;
  // Repli képlérien pour les corps non couverts.
  const k = elementsAt(el, T);
  // Anomalie excentrique.
  const E = solveKepler((k.L - k.varpi) * D, k.e);
  // Cosinus et sinus de l'anomalie excentrique, et racine du complément de l'excentricité.
  const cE = Math.cos(E), sE = Math.sin(E), b = Math.sqrt(1 - k.e * k.e);
  // Facteur de la vitesse : a·n / (1 − e·cos E).
  const f = (k.a * k.n) / (1 - k.e * cE);
  // Position et vitesse, l'une et l'autre tournées vers l'écliptique.
  return {
    position: rotate(k, k.a * (cE - k.e), k.a * b * sE),
    velocity: rotate(k, -f * sE, f * b * cE),
  };
// Fin de heliocentricState.
}

/**
 * Tracé d'une orbite héliocentrique : ellipse osculatrice reconstruite à partir de la position et de la vitesse
 * VSOP87A au même instant. La trajectoire affichée est donc tangente à l'état calculé, et non une ellipse moyenne
 * figée issue d'éléments séculaires.
 * @returns {Float32Array} n × 3 coordonnées
 */
export function orbitPositions(el, T, n = 2048) {
  // Ellipse osculatrice calculée depuis l'état VSOP87A du même instant.
  const precise = vsop87aState(el, T);
  if (precise) return osculatingOrbitPositions(precise.position, precise.velocity, n, AU_UNITS);
  // Repli képlérien pour les corps non couverts.
  const k = elementsAt(el, T);
  // Demi-petit axe.
  const b = k.a * Math.sqrt(1 - k.e * k.e);
  // Les coordonnées de sortie.
  const out = new Float32Array(n * 3);
  // Un point par pas d'anomalie excentrique.
  for (let i = 0; i < n; i++) {
    // L'anomalie excentrique de ce point.
    const E = (i / n) * 2 * Math.PI;
    // Le point, tourné vers l'écliptique.
    const [x, y, z] = rotate(k, k.a * (Math.cos(E) - k.e), b * Math.sin(E));
    // Rangé dans le repère de la scène, en unités de scène.
    out[3 * i] = x * AU_UNITS; out[3 * i + 1] = z * AU_UNITS; out[3 * i + 2] = -y * AU_UNITS;
  // Fin des points.
  }
  // Le tracé.
  return out;
// Fin de orbitPositions.
}

/** Rayon terrestre moyen (km). */
const EARTH_RADIUS_KM = 6371;
/** Précession de l'écliptique de la date vers l'écliptique J2000, en degrés par siècle (repère des planètes). */
const PRECESSION_DEG_PER_CENTURY = 1.3969713;
/** Sinus et cosinus d'un angle en degrés. */
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

/** Inclinaison de l'équateur lunaire sur l'écliptique (lois de Cassini). */
export const MOON_EQUATOR_TILT_DEG = 1.5427;

/**
 * Part de la Lune dans le barycentre Terre–Lune : m_Lune / (m_Terre + m_Lune) = 1 / (1 + 81,30056).
 * Le rapport des masses est celui des éphémérides planétaires modernes.
 */
export const MOON_BARYCENTRE_SHARE = 1 / (1 + 81.30056);

/**
 * Décalage du centre de la Terre par rapport au barycentre Terre–Lune, en UA, repère de la scène.
 *
 * Cette correction reste disponible pour les anciennes tables képlériennes qui décrivaient le barycentre Terre–Lune.
 * La série VSOP87A EARTH utilisée par le moteur décrit directement le centre de la Terre ; earthPosition ne lui
 * applique donc pas une seconde correction.
 */
export function earthOffsetFromBarycentre(T) {
  // Position de la Lune vue de la Terre.
  const { lon, lat, distKm } = moonGeocentric(T);
  // Distance du centre de la Terre au barycentre, en UA, dans la direction opposée à la Lune.
  const r = (-MOON_BARYCENTRE_SHARE * distKm) / AU_KM;
  // Le décalage, dans le repère de la scène.
  return [r * cd(lat) * cd(lon), r * sd(lat), -r * cd(lat) * sd(lon)];
// Fin de earthOffsetFromBarycentre.
}

/** Position du centre de la Terre (et non du barycentre Terre–Lune) dans le repère de la scène, en UA. */
export function earthPosition(el, T) {
  // VSOP87A EARTH donne le centre de la Terre (pas le barycentre Terre–Lune).
  const precise = vsop87aState(el, T);
  if (precise) return [precise.position[0], precise.position[2], -precise.position[1]];
  // Ancienne table de repli : position du barycentre Terre–Lune.
  const b = heliocentric(el, T);
  // Décalage du centre de la Terre.
  const o = earthOffsetFromBarycentre(T);
  // La somme des deux.
  return [b[0] + o[0], b[1] + o[1], b[2] + o[2]];
// Fin de earthPosition.
}
