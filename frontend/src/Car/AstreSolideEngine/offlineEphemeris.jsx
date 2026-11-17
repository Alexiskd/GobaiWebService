/**
 * Modèle d’éphémérides offline de Gobai Space.
 * Aucun fetch, aucune API distante, aucune dépendance à Three.js.
 * Planètes : VSOP87A embarqué, puis éléments képlériens séculaires.
 * Lune : théorie ELP abrégée de Meeus.
 * Satellites : modèle circulaire local avec aKm et periodDays du catalogue.
 */
import { earthPosition, heliocentric, moonGeocentric, centuriesTT } from './planetOrbits.jsx';
import { satelliteState } from './satelliteMath.jsx';

/** Calcule l’état d’un corps à un instant UTC (ms Unix). */
export function calculateOfflineEphemeris(body, timeMs = Date.now()) {
  if (!body) throw new TypeError('Définition du corps astronomique manquante');
  const T = centuriesTT(timeMs);
  const id = String(body.id || body.key || body.name || '').toLowerCase();

  if (body.kind === 'moon' || id === 'moon' || id === 'lune') {
    return { kind: 'moon', timeMs, ...moonGeocentric(T), source: 'ELP-Meeus', offline: true };
  }
  if (body.kind === 'satellite') {
    return { kind: 'satellite', timeMs, ...satelliteState(body, null, timeMs, 60_000, body.pole || null), source: 'Kepler-circulaire', offline: true };
  }
  const isEarth = body.earth === true || id === 'earth' || id === 'terre';
  const position = isEarth ? earthPosition(body.elements, T) : heliocentric(body.elements, T);
  return { kind: 'planet', id: body.id || body.key || body.name, timeMs, position, unit: 'AU', source: 'VSOP87A/Kepler', offline: true };
}

/** Position héliocentrique compatible avec l’ancien moteur 3D (UA, repère Gobai). */
export function calculateOfflineOrbitPosition(body, timeMs = Date.now()) {
  return calculateOfflineEphemeris(body, timeMs).position;
}
