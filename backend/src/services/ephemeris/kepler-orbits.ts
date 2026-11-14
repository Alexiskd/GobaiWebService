/**
 * Orbites calculées localement à partir des éléments képlériens (data/kepler-elements.ts), sans JPL Horizons.
 *
 * 1. Anomalie moyenne M = M0 + n·(t − J2000), n tiré de la 3e loi de Kepler (GM de l'astre central).
 * 2. Équation de Kepler E − e·sin E = M (Newton), puis position dans le plan de l'orbite.
 * 3. Rotations ω, i, Ω vers le plan de référence (`frame`).
 * 4. Plan de référence → écliptique J2000 :
 *      - `ecliptic` : rien à faire ;
 *      - `<planète>-equatorial` : équateur de la planète (pôle UAI, ascension droite α et déclinaison δ), puis
 *        équateur céleste ICRF → écliptique (obliquité ε) ;
 *      - `<planète>-laplace` : plan de Laplace, assimilé à l'équateur pour les satellites proches et à
 *        l'écliptique pour les satellites lointains (au-delà de LAPLACE_FAR_KM), où il suit l'orbite de la planète.
 * Sorties : km (satellites, relatifs à leur planète) ou UA (planètes, héliocentriques), écliptique J2000.
 *
 * Précision : orbite non perturbée et M0 à J2000 ; l'écart grandit avec le temps (précession, résonances).
 */
// Types (effacés à la compilation) d'un astre et de ses éléments d'orbite.
import type { Astre, KeplerElements } from '../data/kepler-elements';
// Écart entre le Temps terrestre et UTC, partagé avec le calcul des orbites des planètes.
import { TT_MINUS_UTC_S } from './planet-orbits';

/** Position à un instant : t en ms UTC, x/y/z dans l'écliptique (km ou UA). */
// Forme d'un point d'une table de positions.
export interface StatePoint {
  // t : l'instant, en millisecondes UTC.
  t: number;
  // x : coordonnée x.
  x: number;
  // y : coordonnée y.
  y: number;
  // z : coordonnée z.
  z: number;
// Fin de StatePoint.
}

// Facteur de conversion des degrés en radians.
const D = Math.PI / 180;
// Instant de référence J2000 : le 1er janvier 2000 à midi UTC, en millisecondes.
const J2000_MS = Date.UTC(2000, 0, 1, 12);
// Inclinaison de l'équateur terrestre sur l'écliptique, en radians.
const OBLIQUITY = 23.4392911 * D;
// Demi-grand axe au-delà duquel un satellite est considéré comme lointain : un million de kilomètres.
const LAPLACE_FAR_KM = 1_000_000;

/** GM de l'astre central : Soleil en UA³/jour², planètes en km³/s² (système Pluton–Charon pour Pluton). */
// Paramètre gravitationnel du Soleil (constante de Gauss au carré), en UA³ par jour².
const GM_SUN_AU3_DAY2 = 0.01720209895 ** 2;
// Paramètre gravitationnel de chaque planète, en km³ par s² :
const GM_KM3_S2: Record<string, number> = {
  // Terre, Mars, Jupiter, Saturne, Uranus, Neptune, Pluton.
  earth: 403_503.24, mars: 42_828.37, jupiter: 126_686_534, saturn: 37_931_187, uranus: 5_793_939, neptune: 6_836_529, pluto: 975.5,
// Fin de la table.
};

/** Pôles UAI (ascension droite, déclinaison en degrés, ICRF J2000). */
// Direction du pôle nord de chaque planète (ascension droite et déclinaison, en degrés) :
const POLES: Record<string, [number, number]> = {
  // Mars, Jupiter, Saturne ;
  mars: [317.681, 52.887], jupiter: [268.057, 64.495], saturn: [40.589, 83.537],
  // Uranus, Neptune, Pluton.
  uranus: [257.311, -15.175], neptune: [299.36, 43.46], pluto: [132.993, -6.163],
// Fin de la table.
};

// Type Vec : un vecteur de trois nombres.
type Vec = [number, number, number];

/** Moyen mouvement (rad par jour). */
// Fonction meanMotion : angle parcouru en moyenne par jour sur l'orbite, en radians.
export function meanMotion(astre: Astre): number {
  // Éléments d'orbite de l'astre.
  const k = astre.kepler;
  // Si la vitesse est donnée directement (en degrés par siècle), on la convertit en radians par jour (36 525 jours par siècle).
  if (k.MDot !== undefined) return (k.MDot * D) / 36_525;
  // Orbite autour du Soleil (en UA) : troisième loi de Kepler, n = √(GM / a³).
  if (k.unit === 'au') return Math.sqrt(GM_SUN_AU3_DAY2 / k.a ** 3);
  // Sinon, paramètre gravitationnel de la planète mère.
  const gm = GM_KM3_S2[astre.parent];
  // Planète inconnue : erreur.
  if (!gm) throw new Error(`GM inconnu pour ${astre.parent}`);
  // Même loi en km et en secondes, multipliée par 86 400 pour passer en jours.
  return Math.sqrt(gm / k.a ** 3) * 86_400;
// Fin de meanMotion.
}

/** Période orbitale en jours. */
// Fonction periodDays : durée d'un tour complet, 2π divisé par l'angle parcouru par jour.
export const periodDays = (astre: Astre) => (2 * Math.PI) / meanMotion(astre);

/**
 * Résout E − e·sin(E) = M pour une orbite elliptique.
 * Entrées en radians ; Newton amorti et anomalie ramenée dans [-π, π].
 */
export function solveKepler(M: number, e: number, tolerance = 1e-13, maxIterations = 64): number {
  if (!Number.isFinite(M)) throw new RangeError('Anomalie moyenne non finie');
  if (!Number.isFinite(e) || e < 0 || e >= 1) throw new RangeError('L’excentricité elliptique doit être comprise entre 0 inclus et 1 exclu');
  if (!Number.isFinite(tolerance) || tolerance <= 0) throw new RangeError('La tolérance doit être strictement positive');
  if (!Number.isInteger(maxIterations) || maxIterations < 1) throw new RangeError('Le nombre maximal d’itérations doit être un entier positif');

  const m = Math.atan2(Math.sin(M), Math.cos(M));
  let E = e < 0.8 ? m : m + 0.85 * e * Math.sign(m || 1);

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const denominator = 1 - e * Math.cos(E);
    const correction = (E - e * Math.sin(E) - m) / denominator;
    const boundedCorrection = Math.max(-1, Math.min(1, correction));
    E -= boundedCorrection;
    if (Math.abs(boundedCorrection) <= tolerance) return E;
  }

  const residual = E - e * Math.sin(E) - m;
  if (Math.abs(residual) <= tolerance * 10) return E;
  throw new Error(`L’équation de Kepler n’a pas convergé (résidu=${residual})`);
}

/** État képlérien dans le plan orbital puis tourné dans le repère du parent. */
export interface OrbitalState {
  position: Vec;
  velocity: Vec;
  distance: number;
  eccentricAnomaly: number;
  trueAnomaly: number;
}

/** Rotation d’un vecteur PQW vers le plan de référence de l’orbite. */
function rotateOrbitalVector(k: KeplerElements, x: number, y: number): Vec {
  const O = k.om * D, w = k.w * D, I = k.i * D;
  const cO = Math.cos(O), sO = Math.sin(O);
  const cw = Math.cos(w), sw = Math.sin(w);
  const cI = Math.cos(I), sI = Math.sin(I);
  return [
    (cO * cw - sO * sw * cI) * x + (-cO * sw - sO * cw * cI) * y,
    (sO * cw + cO * sw * cI) * x + (-sO * sw + cO * cw * cI) * y,
    sw * sI * x + cw * sI * y,
  ];
}

/**
 * Position et vitesse képlériennes dans le repère défini par k.
 * M en radians ; n en radians par jour ; position dans l’unité de k.a,
 * vitesse dans cette même unité par jour.
 */
export function orbitalState(k: KeplerElements, M: number, n: number): OrbitalState {
  if (!Number.isFinite(k.a) || k.a <= 0) throw new RangeError('Le demi-grand axe doit être positif et fini');
  if (!Number.isFinite(n) || n <= 0) throw new RangeError('Le moyen mouvement doit être positif et fini');

  const E = solveKepler(M, k.e);
  const cosE = Math.cos(E), sinE = Math.sin(E);
  const beta = Math.sqrt(1 - k.e * k.e);
  const denominator = 1 - k.e * cosE;
  const distance = k.a * denominator;
  const position = rotateOrbitalVector(k, k.a * (cosE - k.e), k.a * beta * sinE);
  const velocityFactor = (k.a * n) / denominator;
  const velocity = rotateOrbitalVector(k, -velocityFactor * sinE, velocityFactor * beta * cosE);
  const trueAnomaly = 2 * Math.atan2(
    Math.sqrt(1 + k.e) * Math.sin(E / 2),
    Math.sqrt(1 - k.e) * Math.cos(E / 2),
  );

  return { position, velocity, distance, eccentricAnomaly: E, trueAnomaly };
}

/** Position dans le plan de référence de l’orbite (unités de a). */
export function orbitalPosition(k: KeplerElements, M: number): Vec {
  // n=1 ne sert qu’à calculer la position ; la vitesse est ignorée.
  return orbitalState(k, M, 1).position;
}

/** Équateur de la planète → équateur ICRF (axe x = nœud ascendant de l'équateur de la planète, convention UAI). */
// Fonction planetEquatorToIcrf : passe du repère de l'équateur d'une planète au repère céleste.
function planetEquatorToIcrf([x, y, z]: Vec, parent: string): Vec {
  // Direction du pôle de la planète.
  const pole = POLES[parent];
  // Planète inconnue : erreur.
  if (!pole) throw new Error(`Pôle inconnu pour ${parent}`);
  // Ascension droite et déclinaison du pôle, en radians.
  const a = pole[0] * D, d = pole[1] * D;
  // Vecteur du pôle : l'axe z du repère de la planète.
  const P: Vec = [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
  // Axe x de ce repère : la ligne où son équateur coupe l'équateur céleste.
  const Q: Vec = [-Math.sin(a), Math.cos(a), 0];
  // Axe y : le produit vectoriel du pôle par l'axe x.
  const Y: Vec = [P[1] * Q[2] - P[2] * Q[1], P[2] * Q[0] - P[0] * Q[2], P[0] * Q[1] - P[1] * Q[0]];
  // Recompose le vecteur dans le repère céleste à partir de ces trois axes.
  return [x * Q[0] + y * Y[0] + z * P[0], x * Q[1] + y * Y[1] + z * P[1], x * Q[2] + y * Y[2] + z * P[2]];
// Fin de planetEquatorToIcrf.
}

// Fonction icrfToEcliptic : passe du repère céleste à l'écliptique, par une rotation autour de l'axe x :
const icrfToEcliptic = ([x, y, z]: Vec): Vec => [
  // x inchangé ;
  x,
  // nouveau y ;
  y * Math.cos(OBLIQUITY) + z * Math.sin(OBLIQUITY),
  // nouveau z.
  -y * Math.sin(OBLIQUITY) + z * Math.cos(OBLIQUITY),
// Fin du vecteur.
];

/** Plan de référence `frame` → écliptique J2000. */
// Fonction toEcliptic : ramène une position dans l'écliptique selon son plan de référence.
export function toEcliptic(p: Vec, astre: Astre): Vec {
  // Plan de référence des éléments.
  const frame = astre.kepler.frame;
  // Déjà l'écliptique : rien à faire.
  if (frame === 'ecliptic') return p;
  // Le plan est-il un plan de Laplace ?
  const laplace = frame.endsWith('-laplace');
  // Plan de Laplace d'un satellite lointain : assimilé à l'écliptique, rien à faire.
  if (laplace && astre.kepler.a > LAPLACE_FAR_KM) return p; // satellite lointain : plan proche de l'orbite de la planète
  // Sinon : équateur de la planète → repère céleste → écliptique.
  return icrfToEcliptic(planetEquatorToIcrf(p, astre.parent));
// Fin de toEcliptic.
}

/**
 * État képlérien à un instant UTC. Les vitesses sont exprimées dans l’unité de distance
 * par jour ; les satellites restent relatifs à leur planète mère.
 */
export function stateAt(astre: Astre, ms: number): OrbitalState {
  if (!Number.isFinite(ms)) throw new RangeError('Instant UTC invalide');
  const days = (ms - J2000_MS) / 86_400_000 + TT_MINUS_UTC_S / 86_400;
  const T = days / 36_525;
  const k = astre.kepler;
  const M = k.MDot !== undefined
    ? (k.M0 + k.MDot * T) * D
    : (k.M0 * D) + meanMotion(astre) * days;
  const at = {
    ...k,
    om: k.om + (k.omDot ?? 0) * T,
    w: k.w + (k.wDot ?? 0) * T,
  };
  const local = orbitalState(at, M, meanMotion(astre));
  return {
    ...local,
    position: toEcliptic(local.position, astre),
    velocity: toEcliptic(local.velocity, astre),
  };
}

/** Position écliptique J2000 à l’instant ms (UTC), en km ou UA selon l’astre. */
export function positionAt(astre: Astre, ms: number): Vec {
  return stateAt(astre, ms).position;
}

/** Table de positions au pas régulier (même format que les tables Horizons, interpolées par le client). */
// Fonction stateTable : positions d'un astre du début à la fin, à pas régulier.
export function stateTable(astre: Astre, fromMs: number, toMs: number, stepMinutes: number): StatePoint[] {
  // Points produits.
  const out: StatePoint[] = [];
  // Pas en millisecondes.
  const step = stepMinutes * 60_000;
  // Pour chaque instant, du début à la fin incluse :
  for (let t = fromMs; t <= toMs; t += step) {
    // position à cet instant ;
    const [x, y, z] = positionAt(astre, t);
    // ajoutée à la table.
    out.push({ t, x, y, z });
  // Fin de la boucle.
  }
  // Renvoie la table.
  return out;
// Fin de stateTable.
}
