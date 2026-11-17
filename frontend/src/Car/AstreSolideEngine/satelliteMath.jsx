/** Fonctions géométriques communes aux satellites naturels. */
import { calculateSatelliteRelativeKm } from './OfflineOrbitEngine.js';

const KM_PER_EARTH_RADIUS = 6371;

/** Convertit une position écliptique en coordonnées de scène, en rayons terrestres. */
export const eclipticKmToScene = ({ x, y, z }) => [
  x / KM_PER_EARTH_RADIUS,
  z / KM_PER_EARTH_RADIUS,
  -y / KM_PER_EARTH_RADIUS,
];

/** Orbite circulaire de repli en kilomètres. */
export const fallbackRelKm = (def, timeMs, parentPole = null) =>
  calculateSatelliteRelativeKm(def, timeMs, parentPole);

/** Position, vitesse et statut du satellite à un instant donné. */
export function satelliteState(def, _points, timeMs, dtMs = 60_000, parentPole = null) {
  const positionAt = (time) => fallbackRelKm(def, time, parentPole);
  const position = positionAt(timeMs);
  const before = eclipticKmToScene(positionAt(timeMs - dtMs));
  const after = eclipticKmToScene(positionAt(timeMs + dtMs));
  const relative = eclipticKmToScene(position);
  const scale = 1000 / (2 * dtMs);

  return {
    rel: relative,
    vel: after.map((value, i) => (value - before[i]) * scale),
    exact: false,
  };
}

const normalize = (v) => {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Repère de rotation synchrone : face 0 vers la planète, axe Y vers le nord orbital. */
export function synchronousBasis(relative, velocity) {
  const x = normalize(relative.map((value) => -value));
  let y = normalize(cross(relative, velocity));
  const projection = dot(y, x);
  y = normalize(y.map((value, i) => value - projection * x[i]));
  return { x, y, z: cross(x, y) };
}

/** Repère du plan orbital. */
export function orbitBasis(relative, velocity) {
  const x = normalize(relative);
  const y = normalize(cross(relative, velocity));
  return { x, y, z: cross(x, y) };
}

/** Distance planète-satellite en kilomètres. */
export const relDistanceKm = (relative) =>
  Math.hypot(...relative) * KM_PER_EARTH_RADIUS;
