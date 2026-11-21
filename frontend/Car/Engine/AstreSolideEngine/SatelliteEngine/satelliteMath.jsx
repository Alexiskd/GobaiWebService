/**
 * Satellites naturels (Jupiter, Saturne) : calculs purs, testés dans satelliteMath.test.jsx.
 *
 * Positions : solveur képlérien elliptique commun aux planètes, avec éléments relatifs à la planète hôte.
 * Si seuls aKm et periodDays sont fournis, e=0 et l'orbite est circulaire faute d'éléments supplémentaires.
 * Rotation : synchrone (face cachée comme la Lune) : longitude 0 tournée vers la planète, pôle Nord sur la normale
 * de l'orbite. L'hémisphère avant (apex du mouvement) est alors à 90° O, comme dans la convention de l'UAI.
 */
// Importe le solveur képlérien commun aux planètes et aux satellites.
import { D, keplerPositionFromElements } from '../OrbitEngine/planetOrbits.jsx';

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
 * Position képlérienne relative au corps parent, en km dans le repère écliptique.
 * Les données minimales aKm + periodDays définissent une orbite circulaire ; si e et les angles
 * orbitaux sont présents, la même résolution elliptique que pour les planètes est utilisée.
 */
export function fallbackRelKm(def, ms, pole = null) {
  const periodDays = Number(def.periodDays);
  const aKm = Number(def.aKm);
  if (!(aKm > 0) || !Number.isFinite(periodDays) || periodDays === 0) {
    throw new RangeError(`Éléments képlériens invalides pour le satellite ${def.id || def.name || ''}`);
  }
  const dtDays = (ms - (Number.isFinite(def.epochMs) ? def.epochMs : J2000_MS)) / DAY_MS;
  const meanAnomaly = (Number(def.meanAnomalyAtEpochDeg || 0) * D)
    + (2 * Math.PI * dtDays / periodDays);
  const local = keplerPositionFromElements({
    a: aKm,
    e: Number.isFinite(def.eccentricity) ? def.eccentricity : 0,
    inclination: (Number(def.inclinationDeg) || 0) * D,
    ascendingNode: (Number(def.longitudeAscendingNodeDeg) || 0) * D,
    argumentPeriapsis: (Number(def.argumentOfPeriapsisDeg) || 0) * D,
    meanAnomaly,
  });

  // Sans pôle renseigné, le repère local est directement l'écliptique.
  if (!pole) return { x: local[0], y: local[1], z: local[2] };

  // Le pôle du parent définit la normale du plan de référence local, dans le repère Three.js.
  const n = norm(pole);
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = norm(cross(ref, n));
  const v = cross(n, u);
  const scene = [
    local[0] * u[0] + local[1] * v[0] + local[2] * n[0],
    local[0] * u[1] + local[1] * v[1] + local[2] * n[1],
    local[0] * u[2] + local[1] * v[2] + local[2] * n[2],
  ];
  // Retour au repère écliptique utilisé par eclipticKmToScene.
  return { x: scene[0], y: scene[2], z: -scene[1] };
}

/** Position relative (rayons terrestres) et vitesse (scène/seconde), par propagation képlérienne offline. */
export function satelliteState(def, _points, ms, dtMs = 60_000, pole = null) {
  const position = fallbackRelKm(def, ms, pole);
  const before = eclipticKmToScene(fallbackRelKm(def, ms - dtMs, pole));
  const after = eclipticKmToScene(fallbackRelKm(def, ms + dtMs, pole));
  const rel = eclipticKmToScene(position);
  const scale = 1000 / (2 * dtMs);
  return {
    rel,
    vel: [(after[0] - before[0]) * scale, (after[1] - before[1]) * scale, (after[2] - before[2]) * scale],
    exact: false,
    source: 'Kepler-two-body',
  };
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
