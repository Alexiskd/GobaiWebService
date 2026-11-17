/**
 * Moteur orbital local et autonome.
 * Planètes : calcul existant de planetOrbits (VSOP87 / éléments képlériens).
 * Satellites : orbite circulaire calculée avec le demi-grand axe et la période du catalogue.
 * Aucun appel réseau et aucune éphéméride distante.
 */
import { earthPosition, heliocentric } from './planetOrbits.jsx';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

const normalize = (v) => {
  const length = Math.hypot(...v) || 1;
  return v.map((n) => n / length);
};

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Position héliocentrique d'une planète en UA. */
export function calculatePlanetPosition(def, centuriesTT) {
  if (!def?.elements) return null;
  return def.earth
    ? earthPosition(def.elements, centuriesTT)
    : heliocentric(def.elements, centuriesTT);
}

/** Position d'un satellite par rapport à sa planète, en km écliptiques J2000. */
export function calculateSatelliteRelativeKm(def, timeMs, parentPole = null) {
  const radius = Number(def?.aKm);
  const period = Number(def?.periodDays);
  if (!(radius > 0) || !(period > 0)) return { x: 0, y: 0, z: 0 };

  const angle = (2 * Math.PI * (timeMs - J2000_MS)) / (period * DAY_MS);
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  if (!parentPole) return { x, y, z: 0 };

  // Oriente le plan circulaire selon l'axe de rotation connu de la planète.
  const normal = normalize(parentPole);
  const reference = Math.abs(normal[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const axisX = normalize(cross(reference, normal));
  const axisY = cross(normal, axisX);
  const scene = [
    x * axisX[0] + y * axisY[0],
    x * axisX[1] + y * axisY[1],
    x * axisX[2] + y * axisY[2],
  ];
  return { x: scene[0], y: -scene[2], z: scene[1] };
}

/** Petite façade conservée pour ne pas modifier le moteur 3D existant. */
export class OfflineOrbitEngine {
  planet(def, centuriesTT) {
    return calculatePlanetPosition(def, centuriesTT);
  }

  satellite(def, timeMs, parentPole) {
    return calculateSatelliteRelativeKm(def, timeMs, parentPole);
  }
}
