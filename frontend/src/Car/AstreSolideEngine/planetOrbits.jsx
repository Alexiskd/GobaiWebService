/**
 * Orbites des planètes : calcul local, sans aucun appel réseau.
 *
 * Méthode unique : résolution képlérienne à deux corps pour les planètes et les satellites. Le Soleil est
 * l'origine fixe ; chaque satellite est calculé dans le référentiel de sa planète hôte. Aucun appel réseau.
 *
 * Éléments : table « Keplerian Elements for Approximate Positions of the Major Planets », valable de 1800 à 2050,
 * rangée dans frontend/src/Car/data/astronomy/data/bodies.data.ts sous la forme
 *   [a, a', e, e', I, I', L, L', ϖ, ϖ', Ω, Ω']   (a en UA, angles en degrés, dérives par siècle julien).
 * Ce sont des données statiques versionnées dans le dépôt, pas un service interrogé à l'exécution.
 *
 * Les échelles de temps comptent : les éléments sont rapportés au Temps terrestre, pas à UTC (§ 4.B).
 *
 * Repères. Deux conventions cohabitent et ne doivent pas être confondues :
 *  - écliptique J2000 « mathématique » : (x, y, z), x vers l'équinoxe de mars, z vers le pôle nord de l'écliptique ;
 *  - repère de la scène 3D : (x, z, −y) de la précédente, parce que Three.js dessine la verticale en y.
 * Les fonctions dont le nom finit par `Ecliptic` rendent la première ; les autres rendent celle de la scène.
 */



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
    // Moyen mouvement képlérien (rad/jour), déduit de la troisième loi de Kepler avec la masse solaire.
    n: 0.01720209895 / Math.pow(el[0] + el[1] * T, 1.5),
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
 * Résout une orbite elliptique képlérienne et retourne sa position dans le repère inertiel fourni.
 * Les angles sont en radians et a conserve l'unité fournie (UA pour les planètes, km pour les satellites).
 */
export function keplerPositionFromElements({ a, e = 0, inclination = 0, ascendingNode = 0, argumentPeriapsis = 0, meanAnomaly = 0 }) {
  if (!(Number.isFinite(a) && a > 0)) throw new RangeError('Le demi-grand axe doit être positif.');
  if (!(Number.isFinite(e) && e >= 0 && e < 1)) throw new RangeError('Le modèle Kepler elliptique exige 0 ≤ e < 1.');
  const E = solveKepler(meanAnomaly, e);
  const x = a * (Math.cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(argumentPeriapsis), sw = Math.sin(argumentPeriapsis);
  const cO = Math.cos(ascendingNode), sO = Math.sin(ascendingNode);
  const cI = Math.cos(inclination), sI = Math.sin(inclination);
  return [
    (cw*cO - sw*sO*cI)*x + (-sw*cO - cw*sO*cI)*y,
    (cw*sO + sw*cO*cI)*x + (-sw*sO + cw*cO*cI)*y,
    sw*sI*x + cw*sI*y,
  ];
}

/** Position héliocentrique képlérienne dans l'écliptique J2000 (UA). */
export function heliocentricEcliptic(el, T, meanAnomalyDeg) {
  const k = elementsAt(el, T);
  const M = meanAnomalyDeg === undefined
    ? (el[6] - el[8]) * D + k.n * T * 36525
    : meanAnomalyDeg * D;
  return keplerPositionFromElements({
    a: k.a, e: k.e, inclination: k.I, ascendingNode: k.Om,
    argumentPeriapsis: k.varpi * D - k.Om, meanAnomaly: M,
  });
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
  const k = elementsAt(el, T);
  const M = (el[6] - el[8]) * D + k.n * T * 36525;
  const E = solveKepler(M, k.e);
  const cE = Math.cos(E), sE = Math.sin(E), b = Math.sqrt(1 - k.e * k.e);
  const f = (k.a * k.n) / (1 - k.e * cE);
  return {
    position: keplerPositionFromElements({
      a: k.a, e: k.e, inclination: k.I, ascendingNode: k.Om,
      argumentPeriapsis: k.varpi * D - k.Om, meanAnomaly: M,
    }),
    velocity: rotate(k, -f * sE, f * b * cE),
  };
}

/**
 * Tracé de l'ellipse képlérienne définie par les éléments orbitaux à l'instant demandé.
 * @returns {Float32Array} n × 3 coordonnées
 */
export function orbitPositions(el, T, n = 2048) {
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

/**
 * Éléments képlériens moyens simplifiés de la Lune, référencés à J2000.
 * Ils servent uniquement au modèle à deux corps demandé ; les perturbations lunaires ne sont pas modélisées.
 */
export const MOON_KEPLER_ELEMENTS = Object.freeze({
  aKm: 384400,
  periodDays: 27.321661,
  eccentricity: 0.0549,
  inclinationDeg: 5.145,
  longitudeAscendingNodeDeg: 125.08,
  argumentOfPeriapsisDeg: 318.15,
  meanAnomalyAtEpochDeg: 115.3654,
  epochMs: Date.UTC(2000, 0, 1, 12),
});
/** Position du centre de la Terre dans le référentiel héliocentrique fixe, en UA. */
export function earthPosition(el, T) {
  return heliocentric(el, T);
}
