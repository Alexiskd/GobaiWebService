export const PARSEC_IN_AU = 206264.80624709636;
export const INTERSTELLAR_OVERVIEW_AU_PER_PC = 512;
export const INTERSTELLAR_DISTANCE_COMPRESSION = PARSEC_IN_AU / INTERSTELLAR_OVERVIEW_AU_PER_PC;

const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

/**
 * Le Système solaire conserve son échelle AU habituelle. Pour la vue globale,
 * les distances entre systèmes sont compressées : 1 pc d'affichage = 512 UA
 * de scène. Cela rend Proxima visible dans la plage de zoom de l'application.
 */
export function createInterstellarEngineConfig({ auUnits = 23455, overviewAuPerPc = INTERSTELLAR_OVERVIEW_AU_PER_PC } = {}) {
  if (!positive(auUnits)) throw new RangeError('auUnits doit être strictement positif.');
  if (!positive(overviewAuPerPc)) throw new RangeError('overviewAuPerPc doit être strictement positif.');
  return Object.freeze({
    auToSceneUnits: Number(auUnits),
    parsecToSceneUnits: Number(auUnits) * Number(overviewAuPerPc),
    overviewAuPerPc: Number(overviewAuPerPc),
    trueAuPerPc: PARSEC_IN_AU,
    distanceCompressionFactor: PARSEC_IN_AU / Number(overviewAuPerPc),
    distanceMode: 'compressed-interstellar-overview',
    focusRadius: 2.5,
    focusDistance: 25,
    perivolumeRadiusAu: 10,
  });
}

/** Position caméra locale + origine flottante = position globale du navigateur dans le repère Gobai. */
export function globalCameraPosition(cameraPosition, floatingOrigin) {
  if (![cameraPosition?.x, cameraPosition?.y, cameraPosition?.z, floatingOrigin?.x, floatingOrigin?.y, floatingOrigin?.z].every(Number.isFinite)) {
    throw new TypeError('La caméra et l’origine flottante doivent être des vecteurs 3D finis.');
  }
  return {
    x: cameraPosition.x + floatingOrigin.x,
    y: cameraPosition.y + floatingOrigin.y,
    z: cameraPosition.z + floatingOrigin.z,
  };
}

/** Identifiant de périvolume stable, compatible avec l’axiome Soleil / Proxima Centauri. */
export function resolveInterstellarSystemId(starSystem, requestedId) {
  if (typeof requestedId === 'string' && requestedId.trim()) return requestedId.trim();
  const name = String(starSystem?.star?.name || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (name.includes('proxima centauri')) return 'system:proxima-centauri';
  const sourceId = String(starSystem?.id || name || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `system:external:${sourceId || 'unknown'}`;
}

/** Rayon global couvrant au minimum 10 UA et les orbites connues du système. */
export function resolveInterstellarPerivolumeRadius(options = {}, auUnits = 23455, starSystem = null) {
  if (positive(options.perivolumeRadius)) return Number(options.perivolumeRadius);
  const requestedAu = positive(options.perivolumeRadiusAu) ? Number(options.perivolumeRadiusAu) : 10;
  const outerOrbitAu = (starSystem?.planets || []).reduce((max, planet) => {
    const a = Number(planet?.orbit?.semiMajorAxisAu);
    const e = Number(planet?.orbit?.eccentricity);
    if (!positive(a)) return max;
    return Math.max(max, a * (1 + (Number.isFinite(e) && e >= 0 && e < 1 ? e : 0)) * 3);
  }, 0);
  return Math.max(requestedAu, outerOrbitAu) * Number(auUnits);
}

/** Distance de cadrage suffisante pour voir l’orbite planétaire la plus externe connue. */
export function resolveInterstellarFocusDistance(starSystem, auUnits = 23455, fallback = 25) {
  const outerOrbitAu = (starSystem?.planets || []).reduce((max, planet) => {
    const a = Number(planet?.orbit?.semiMajorAxisAu);
    const e = Number(planet?.orbit?.eccentricity);
    if (!positive(a)) return max;
    return Math.max(max, a * (1 + (Number.isFinite(e) && e >= 0 && e < 1 ? e : 0)));
  }, 0);
  return Math.max(Number(fallback) || 25, outerOrbitAu * Number(auUnits) * 2.8);
}
