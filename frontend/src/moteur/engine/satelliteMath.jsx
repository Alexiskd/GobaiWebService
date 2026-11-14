/**
 * Satellites naturels (Jupiter, Saturne) : calculs purs, testés dans satelliteMath.test.jsx.
 *
 * Positions : table JPL Horizons planète → satellite (km, écliptique J2000), interpolée comme celle de la Lune ;
 * sans table, orbite circulaire de repli dans le plan équatorial de la planète (position indicative seulement).
 * Rotation : synchrone (face cachée comme la Lune) : longitude 0 tournée vers la planète, pôle Nord sur la normale
 * de l'orbite. L'hémisphère avant (apex du mouvement) est alors à 90° O, comme dans la convention de l'UAI.
 */
// Importe interpolateState, l'interpolation d'une table de positions, depuis moonEphemeris.
import { interpolateState } from './moonEphemeris';

// Rayon de la Terre en kilomètres : l'unité de longueur de la scène.
const KM_PER_EARTH_RADIUS = 6371;
// Instant J2000 en millisecondes : le 1er janvier 2000 à 12 h UTC.
const J2000_MS = Date.UTC(2000, 0, 1, 12);
// Nombre de millisecondes dans un jour.
const DAY_MS = 864e5;

/** Vecteur écliptique (km) → repère de la scène (rayons terrestres) : (x, y, z) → (x, z, −y). */
// Déclare et exporte eclipticKmToScene : divise par le rayon terrestre et range (x, y, z) en (x, z, −y).
export const eclipticKmToScene = ({ x, y, z }) => [x / KM_PER_EARTH_RADIUS, z / KM_PER_EARTH_RADIUS, -y / KM_PER_EARTH_RADIUS];

/**
 * Orbite de repli (km, écliptique) : cercle de rayon aKm, période periodDays, phase nulle à J2000, dans le plan
 * perpendiculaire à `pole` (pôle de la planète, repère de la scène) ou dans l'écliptique sans pôle connu.
 */
// Déclare et exporte fallbackRelKm : la définition du satellite, l'instant en millisecondes et le pôle de la planète (aucun par défaut).
export function fallbackRelKm(def, ms, pole = null) {
  // Angle parcouru depuis J2000 : un tour par période.
  const angle = (2 * Math.PI * (ms - J2000_MS)) / (def.periodDays * DAY_MS);
  // Les deux coordonnées du point sur le cercle de rayon aKm.
  const c = Math.cos(angle) * def.aKm, s = Math.sin(angle) * def.aKm;
  // Sans pôle : cercle dans le plan de l'écliptique.
  if (!pole) return { x: c, y: s, z: 0 };
  // Base du plan équatorial dans la scène, puis retour à l'écliptique : scène (x, y, z) = écliptique (x, z, −y).
  // Pôle rendu unitaire.
  const n = norm(pole);
  // Axe de référence : le deuxième axe de la scène, ou le premier quand le pôle en est trop proche.
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  // Premier vecteur du plan équatorial : perpendiculaire à la référence et au pôle, unitaire.
  const u = norm(cross(ref, n));
  // Second vecteur du plan : perpendiculaire au pôle et au premier.
  const w = cross(n, u);
  // Point de l'orbite dans la scène : combinaison des deux vecteurs.
  const p = [c * u[0] + s * w[0], c * u[1] + s * w[1], c * u[2] + s * w[2]];
  // Le renvoie dans le repère écliptique : (x, y, z) de la scène devient (x, −z, y).
  return { x: p[0], y: -p[2], z: p[1] };
// Fin de fallbackRelKm.
}

/**
 * Position relative à la planète (repère de la scène) et vitesse (scène par seconde), à l'instant `ms`.
 * `exact` : vrai quand la table Horizons couvre l'instant.
 */
// Déclare et exporte satelliteState : la définition, la table de points, l'instant, le pas de temps (une minute par défaut) et le pôle.
export function satelliteState(def, points, ms, dtMs = 60_000, pole = null) {
  // at : position interpolée dans la table à un instant, ou null sans table ou hors de la table.
  const at = (t) => (points && interpolateState(points, t)) || null;
  // Position de la table à l'instant demandé.
  const p = at(ms);
  // exact : vrai quand la table a donné une position.
  const exact = Boolean(p);
  // get : position à un instant, par la table quand elle couvre l'instant demandé, sinon par l'orbite de repli (aussi quand la table ne couvre pas cet instant voisin).
  const get = (t) => (exact ? at(t) : fallbackRelKm(def, t, pole)) || fallbackRelKm(def, t, pole);
  // Position relative dans la scène : celle de la table, ou celle du repli.
  const rel = eclipticKmToScene(exact ? p : fallbackRelKm(def, ms, pole));
  // Position un pas de temps avant.
  const a = eclipticKmToScene(get(ms - dtMs));
  // Position un pas de temps après.
  const b = eclipticKmToScene(get(ms + dtMs));
  // Facteur qui convertit l'écart entre ces deux positions en vitesse par seconde.
  const s = 1000 / (2 * dtMs);
  // Renvoie la position, la vitesse (différence des deux positions voisines) et exact.
  return { rel, vel: [(b[0] - a[0]) * s, (b[1] - a[1]) * s, (b[2] - a[2]) * s], exact };
// Fin de satelliteState.
}

// norm : rend un vecteur unitaire (début).
const norm = (v) => {
  // Sa longueur, ou 1 quand elle est nulle.
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  // Renvoie le vecteur divisé par cette longueur.
  return [v[0] / l, v[1] / l, v[2] / l];
// Fin de norm.
};
// cross : produit vectoriel de deux vecteurs.
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// dot : produit scalaire de deux vecteurs.
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Repère du satellite (rotation synchrone) : x vers la planète (longitude 0), y = pôle Nord (normale de l'orbite),
 * z = x × y (direction du mouvement, donc 90° E à l'arrière). Renvoie les trois axes unitaires, orthogonaux, directs.
 */
// Déclare et exporte synchronousBasis : la position relative et la vitesse.
export function synchronousBasis(rel, vel) {
  // Axe x : du satellite vers la planète, unitaire.
  const x = norm([-rel[0], -rel[1], -rel[2]]);
  // Axe y provisoire : la normale de l'orbite, position × vitesse.
  let y = norm(cross(rel, vel));
  // Part de y qui se trouve le long de x.
  const k = dot(y, x);
  // Retire cette part et rend y unitaire : y est exactement perpendiculaire à x.
  y = norm([y[0] - k * x[0], y[1] - k * x[1], y[2] - k * x[2]]);
  // Axe z : x × y.
  const z = cross(x, y);
  // Renvoie les trois axes.
  return { x, y, z };
// Fin de synchronousBasis.
}

/** Repère du cercle d'orbite : x vers le satellite, y normale de l'orbite, z complète (cercle unité dans le plan xz). */
// Déclare et exporte orbitBasis : la position relative et la vitesse.
export function orbitBasis(rel, vel) {
  // Axe x : vers le satellite, unitaire.
  const x = norm(rel);
  // Axe y : la normale de l'orbite, unitaire.
  const y = norm(cross(rel, vel));
  // Renvoie x, y et z = x × y.
  return { x, y, z: cross(x, y) };
// Fin de orbitBasis.
}

/** Distance (km) planète → satellite. */
// Déclare et exporte relDistanceKm : la longueur de la position relative, reconvertie en kilomètres.
export const relDistanceKm = (rel) => Math.hypot(rel[0], rel[1], rel[2]) * KM_PER_EARTH_RADIUS;
