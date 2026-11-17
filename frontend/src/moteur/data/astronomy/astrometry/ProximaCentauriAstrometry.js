import { propagateAstrometricCoordinates, propagateAstrometricRecord } from './AstrometricEngine.js';

const icrsToHeliocentricParsecs = ({ raDeg, decDeg, distancePc }) => {
  const ra = raDeg * Math.PI / 180;
  const dec = decDeg * Math.PI / 180;
  return { x: distancePc * Math.cos(dec) * Math.cos(ra), y: distancePc * Math.cos(dec) * Math.sin(ra), z: distancePc * Math.sin(dec) };
};
const icrsParsecsToScene = (position, { parsecToSceneUnits, origin }) => ({
  x: origin.x + position.x * parsecToSceneUnits,
  y: origin.y + position.z * parsecToSceneUnits,
  z: origin.z - position.y * parsecToSceneUnits,
});

/**
 * Astrométrie de référence Proxima Centauri.
 * Coordonnées ICRS J2000 et paramètres astrométriques publiés par SIMBAD.
 * Gaia DR3 source_id sert d'identifiant croisé, pas de preuve que les valeurs
 * ci-dessous sont les paramètres natifs de la solution Gaia DR3.
 */
export const PROXIMA_CENTAURI_ASTROMETRY = Object.freeze({
  id: 'star:proxima-centauri',
  name: 'Proxima Centauri',
  kind: 'star',
  coordinates: Object.freeze({
    frame: 'ICRS',
    epoch: 2000.0,
    raDeg: 217.4289422216058,
    decDeg: -62.67949018907555,
  }),
  astrometry: Object.freeze({
    parallaxMas: 768.0665,
    properMotionRaMasYr: -3781.741,
    properMotionDecMasYr: 769.465,
    radialVelocityKmS: -20.578199,
  }),
  identifiers: Object.freeze([
    Object.freeze({ catalog: 'Gaia DR3', value: '5853498713190525696' }),
    Object.freeze({ catalog: 'Gaia DR2', value: '5853498713160606720' }),
    Object.freeze({ catalog: 'HIP', value: '70890' }),
    Object.freeze({ catalog: 'Gliese', value: 'GJ 551' }),
    Object.freeze({ catalog: 'SIMBAD', value: 'Proxima Centauri' }),
  ]),
  provenance: Object.freeze({
    provider: 'CDS SIMBAD',
    coordinateReference: 'ICRS J2000.0',
    astrometryReference: 'SIMBAD basic data; parallax/proper-motion catalogue reference 2020yCat.1350....0G; radial velocity reference 2020AJ....160..120J',
    retrievedAt: '2026-11-17',
    caveat: 'Les paramètres sont une compilation SIMBAD, pas une ligne Gaia DR3 brute. Pour une réduction de précision, remplacer par les colonnes Gaia DR3 et leur covariance à ref_epoch=2016.0.',
  }),
});

export function createProximaCentauriAstrometricRecord(overrides = {}) {
  return {
    ...PROXIMA_CENTAURI_ASTROMETRY,
    ...overrides,
    coordinates: { ...PROXIMA_CENTAURI_ASTROMETRY.coordinates, ...(overrides.coordinates || {}) },
    astrometry: { ...PROXIMA_CENTAURI_ASTROMETRY.astrometry, ...(overrides.astrometry || {}) },
    identifiers: overrides.identifiers || PROXIMA_CENTAURI_ASTROMETRY.identifiers,
    provenance: { ...PROXIMA_CENTAURI_ASTROMETRY.provenance, ...(overrides.provenance || {}) },
  };
}

/** Position héliocentrique calculée à l'époque demandée, en parsecs et axes ICRS. */
export function calculateProximaCentauriPosition(targetEpoch = 2026.0, options = {}) {
  const record = createProximaCentauriAstrometricRecord(options.record || {});
  const propagated = propagateAstrometricCoordinates(record, targetEpoch);
  const heliocentricParsecs = icrsToHeliocentricParsecs({
    raDeg: propagated.raDeg,
    decDeg: propagated.decDeg,
    distancePc: propagated.distancePc,
  });
  const scenePosition = options.parsecToSceneUnits
    ? icrsParsecsToScene(heliocentricParsecs, {
      parsecToSceneUnits: options.parsecToSceneUnits,
      origin: options.origin || { x: 0, y: 0, z: 0 },
    })
    : null;
  return {
    id: record.id,
    name: record.name,
    frame: 'ICRS heliocentric',
    epoch: propagated.epoch,
    sourceEpoch: propagated.sourceEpoch,
    raDeg: propagated.raDeg,
    decDeg: propagated.decDeg,
    distancePc: propagated.distancePc,
    distanceLightYears: propagated.distancePc * 3.261563777,
    parallaxMas: propagated.parallaxMas,
    heliocentricParsecs,
    scenePosition,
    velocityIcrsPcYr: propagated.velocityIcrsPcYr,
    tangentialVelocityKmS: propagated.tangentialVelocityKmS,
    radialVelocityKmS: propagated.radialVelocityKmS,
    totalSpaceVelocityKmS: propagated.totalSpaceVelocityKmS,
    positionUncertainty: propagated.positionUncertainty,
    uncertaintyStatus: propagated.uncertaintyStatus,
    method: propagated.method,
    used: propagated.used,
    warnings: [...propagated.warnings, record.provenance.caveat],
    provenance: record.provenance,
  };
}

export function propagateProximaCentauriRecord(targetEpoch = 2026.0, overrides = {}) {
  return propagateAstrometricRecord(createProximaCentauriAstrometricRecord(overrides), targetEpoch);
}
