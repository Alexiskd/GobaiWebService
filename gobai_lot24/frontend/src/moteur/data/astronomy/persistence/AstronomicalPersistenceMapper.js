const finiteOrNull = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const cleanString = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;

/** Transforme un modèle StarSystemEngine en lignes métier sans perdre les données sources. */
export function mapStarSystemForPersistence(system) {
  if (!system || system.kind !== 'star-system' || !system.star) throw new TypeError('Un star-system normalisé est requis.');
  const star = system.star;
  const gaiaId = star.canonicalIdentifier?.catalog === 'Gaia DR3' ? String(star.canonicalIdentifier.value) : null;
  const starKey = gaiaId ? `gaia:${gaiaId}` : `gobai:${String(star.id || system.id)}`;
  const coordinates = star.coordinates || {};
  const astrometry = star.astrometry || {};
  const starRow = {
    canonicalKey: starKey,
    gaiaDr3SourceId: gaiaId,
    primaryName: cleanString(star.name),
    raDeg: finiteOrNull(coordinates.raDeg),
    decDeg: finiteOrNull(coordinates.decDeg),
    parallaxMas: finiteOrNull(astrometry.parallaxMas),
    properMotionRaMasYr: finiteOrNull(astrometry.properMotionRaMasYr ?? astrometry.pmRaMasYr),
    properMotionDecMasYr: finiteOrNull(astrometry.properMotionDecMasYr ?? astrometry.pmDecMasYr),
    radialVelocityKmS: finiteOrNull(astrometry.radialVelocityKmS),
    referenceEpochJyear: finiteOrNull(coordinates.epoch),
    astrometry,
    provenance: Array.isArray(star.provenance) ? star.provenance : [],
    sourcePayload: Array.isArray(star.sourceRecords) ? star.sourceRecords : [],
  };
  const planets = (system.planets || []).map((planet) => {
    const orbit = planet.orbit || {};
    const physical = planet.physical || {};
    const planetKey = planet.id ? `nasa:${planet.id}` : `name:${String(planet.name || '').toLowerCase()}`;
    return {
      canonicalKey: planetKey,
      nasaPlName: cleanString(planet.name),
      hostName: cleanString(planet.host?.name),
      hostGaiaDr3SourceId: cleanString(planet.host?.gaiaDr3Id ?? planet.host?.gaiaDr3SourceId),
      hostStarCanonicalKey: gaiaId && String(planet.host?.gaiaDr3Id ?? planet.host?.gaiaDr3SourceId) === gaiaId ? starKey : null,
      hostLinkStatus: gaiaId && String(planet.host?.gaiaDr3Id ?? planet.host?.gaiaDr3SourceId) === gaiaId ? 'verified-gaia-id' : 'unresolved',
      orbitalPeriodDays: finiteOrNull(orbit.periodDays),
      semiMajorAxisAu: finiteOrNull(orbit.semiMajorAxisAu),
      eccentricity: finiteOrNull(orbit.eccentricity),
      inclinationDeg: finiteOrNull(orbit.inclinationDeg),
      argumentPeriastronDeg: finiteOrNull(orbit.argumentOfPeriastronDeg),
      periastronEpochJd: finiteOrNull(orbit.periastronEpochJulianDate),
      radiusEarth: finiteOrNull(physical.radiusEarth),
      massEarth: finiteOrNull(physical.massEarth),
      physical,
      orbit,
      discovery: planet.discovery || {},
      provenance: planet.provenance || {},
      sourcePayload: planet,
    };
  });
  return { star: starRow, planets, sourceSystemId: String(system.id), schemaVersion: system.schemaVersion || 1 };
}

export function mapPositionSample({ objectKey, epochJulianDate, frame, position, velocity = null, units = 'AU', source = 'Gobai', metadata = {} } = {}) {
  if (!objectKey || !Number.isFinite(Number(epochJulianDate)) || !['ICRS', 'ORBITAL-REFERENCE', 'GOBAI-SCENE'].includes(frame)) {
    throw new TypeError('Clé objet, époque julienne et repère valides requis.');
  }
  if (![position?.x, position?.y, position?.z].every((value) => Number.isFinite(Number(value)))) throw new TypeError('Position 3D invalide.');
  return {
    objectKey: String(objectKey), epochJulianDate: Number(epochJulianDate), frame,
    x: Number(position.x), y: Number(position.y), z: Number(position.z),
    vx: finiteOrNull(velocity?.x), vy: finiteOrNull(velocity?.y), vz: finiteOrNull(velocity?.z),
    units: String(units), source: String(source), metadata,
  };
}
