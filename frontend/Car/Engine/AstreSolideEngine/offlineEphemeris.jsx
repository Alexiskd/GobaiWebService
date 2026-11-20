/**
 * Modèle d’éphémérides offline de Gobai Space.
 * Aucun fetch, aucune API distante, aucune dépendance à Three.js.
 * Tous les corps : même solveur képlérien elliptique. Soleil fixe ; satellites relatifs à leur planète.
 */
import { earthPosition, heliocentric, centuriesTT, MOON_KEPLER_ELEMENTS } from './planetOrbits.jsx';
import { satelliteState } from './satelliteMath.jsx';

/** Calcule l’état d’un corps à un instant UTC (ms Unix). */
export function calculateOfflineEphemeris(body, timeMs = Date.now()) {
  if (!body) throw new TypeError('Définition du corps astronomique manquante');
  const T = centuriesTT(timeMs);
  const id = String(body.id || body.key || body.name || '').toLowerCase();

  if (body.kind === 'moon' || id === 'moon' || id === 'lune') {
    return { kind: 'moon', timeMs, ...satelliteState(MOON_KEPLER_ELEMENTS, null, timeMs), source: 'Kepler-two-body', offline: true };
  }
  if (body.kind === 'satellite') {
    return { kind: 'satellite', timeMs, ...satelliteState(body, null, timeMs, 60_000, body.pole || null), source: 'Kepler-two-body', offline: true };
  }
  const isEarth = body.earth === true || id === 'earth' || id === 'terre';
  const position = isEarth ? earthPosition(body.elements, T) : heliocentric(body.elements, T);
  return { kind: 'planet', id: body.id || body.key || body.name, timeMs, position, unit: 'AU', source: 'Kepler-two-body', offline: true };
}

/** Position héliocentrique compatible avec l’ancien moteur 3D (UA, repère Gobai). */
export function calculateOfflineOrbitPosition(body, timeMs = Date.now()) {
  return calculateOfflineEphemeris(body, timeMs).position;
}
