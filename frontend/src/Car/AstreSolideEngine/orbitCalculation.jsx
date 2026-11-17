/**
 * Calcul orbital unique pour l'affichage des planètes.
 * Priorité aux vecteurs JPL Horizons interpolés ; repli sur la théorie locale.
 * Les positions sont exprimées en unités astronomiques, repère de scène Gobai.
 */
import { interpolateHorizonsVector, AU_KM } from './jplHorizonsClient.jsx';
import { earthPosition, heliocentric } from './ephemeris.jsx';

export function calculateOrbitPosition(body, timeMs, centuries) {
  const points = body?.horizonsPoints;
  const vector = interpolateHorizonsVector(points, timeMs);

  if (vector) {
    return [vector.x / AU_KM, vector.z / AU_KM, -vector.y / AU_KM];
  }

  return body?.earth
    ? earthPosition(body.elements, centuries)
    : heliocentric(body.elements, centuries);
}
