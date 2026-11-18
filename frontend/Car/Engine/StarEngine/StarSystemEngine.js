import { propagateAstrometricRecord } from '../SystemeEngine/data/astronomy/astrometry/AstrometricEngine.js';
import { calculateExoplanetRecordPosition } from '../SystemeEngine/data/astronomy/orbits/ExoplanetOrbitalEngine.js';
import { resolveAstronomicalCrossReferences } from '../SystemeEngine/data/astronomy/providers/AstronomicalCrossReferenceResolver.js';
import { auditAstronomicalCatalog, classifyAstronomicalExistence } from '../SystemeEngine/data/astronomy/providers/AstronomicalCatalogIntegrity.js';

const isFiniteValue = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

function recordKey(record, index) {
  return record?.id || `${record?.source || 'unknown'}:${record?.name || record?.sourceId || index}`;
}

function selectStarRecord(records) {
  // Gaia is preferred for measured astrometry; SIMBAD enriches the display identity.
  return records.find((record) => record?.source === 'ESA Gaia DR3' && record.coordinates)
    || records.find((record) => record?.coordinates)
    || records[0]
    || null;
}

function enrichStar(records, targetEpochJulianYear) {
  const primary = selectStarRecord(records);
  if (!primary) return null;
  const named = records.find((record) => record?.source === 'CDS SIMBAD' && record.name)
    || records.find((record) => record?.name);
  let astrometricRecord = primary;
  let propagation = null;
  const canPropagate = isFiniteValue(targetEpochJulianYear)
    && isFiniteValue(primary.coordinates?.epoch)
    && isFiniteValue(primary.coordinates?.raDeg)
    && isFiniteValue(primary.coordinates?.decDeg)
    && primary.astrometry;
  if (canPropagate) {
    astrometricRecord = propagateAstrometricRecord(primary, Number(targetEpochJulianYear));
    propagation = astrometricRecord.propagation;
  }
  return {
    id: primary.id,
    name: named?.name || primary.name || primary.sourceId || primary.id,
    canonicalIdentifier: primary.source === 'ESA Gaia DR3' && primary.sourceId
      ? { catalog: 'Gaia DR3', value: primary.sourceId }
      : null,
    coordinates: astrometricRecord.coordinates || null,
    radiusSolar: isFiniteValue(primary.physical?.radiusSolar) ? Number(primary.physical.radiusSolar) : null,
    astrometry: astrometricRecord.astrometry || null,
    propagation,
    sourceRecords: records,
    provenance: records.map((record) => ({ id: record.id, source: record.source, retrievedAt: record.provenance?.retrievedAt ?? null })),
    existenceEvidence: classifyAstronomicalExistence(primary),
  };
}

function orbitalStateFor(planet, targetJulianDate, orbitOverridesByPlanetId) {
  if (!isFiniteValue(targetJulianDate)) return { status: 'not-requested', position: null, warnings: [] };
  const overrides = orbitOverridesByPlanetId?.[planet.id] || {};
  try {
    const state = calculateExoplanetRecordPosition(planet, Number(targetJulianDate), { orbitOverrides: overrides });
    return { status: 'calculated', position: state, warnings: state.warnings };
  } catch (error) {
    return { status: 'unavailable', position: null, warnings: [error.message] };
  }
}

/**
 * Assemble des systèmes stellaires sans fusionner les correspondances incertaines.
 * Les planètes sont attachées automatiquement uniquement via un identifiant Gaia DR3 exact.
 */
export function buildStarSystems(records = [], options = {}) {
  if (!Array.isArray(records)) throw new TypeError('records doit être un tableau.');
  const catalogIntegrity = auditAstronomicalCatalog(records, { coordinateToleranceArcsec: options.coordinateToleranceArcsec ?? 1 });
  const canonicalRecords = catalogIntegrity.canonicalRecords;
  const graph = resolveAstronomicalCrossReferences(canonicalRecords, {
    coordinateToleranceArcsec: options.coordinateToleranceArcsec ?? 1,
    maxCoordinateCandidates: options.maxCoordinateCandidates ?? 5,
  });
  const indexed = new Map(canonicalRecords.filter(Boolean).map((record, index) => [recordKey(record, index), record]));
  const planets = canonicalRecords.filter((record) => record?.kind === 'exoplanet');
  const systems = graph.entities.map((entity) => {
    const sourceRecords = entity.sourceRecords.map((key) => indexed.get(key)).filter(Boolean);
    const star = enrichStar(sourceRecords, options.targetEpochJulianYear);
    return {
      id: entity.id,
      kind: 'star-system',
      identityStatus: entity.canonicalIdentifier ? 'verified-gaia-identity' : 'unresolved-identity',
      star,
      planets: [],
      sourceRecordIds: entity.sourceRecords,
    };
  });
  const systemBySourceKey = new Map();
  systems.forEach((system) => system.sourceRecordIds.forEach((key) => systemBySourceKey.set(key, system)));
  const candidatePlanetHosts = [];
  const planetLinks = new Map(graph.planetHostLinks.map((link) => [link.planet, link]));

  planets.forEach((planet, index) => {
    const key = recordKey(planet, canonicalRecords.indexOf(planet));
    const link = planetLinks.get(key);
    if (link?.status === 'linked-by-gaia-id' && systemBySourceKey.has(link.host)) {
      const system = systemBySourceKey.get(link.host);
      if (!isFiniteValue(system.star.radiusSolar) && isFiniteValue(planet.host?.radiusSolar)) system.star.radiusSolar = Number(planet.host.radiusSolar);
      if (!system.star.sourceRecords?.some((record) => record?.source === 'CDS SIMBAD' && record.name) && planet.host?.name) {
        system.star.name = planet.host.name;
      }
      system.planets.push({
        id: planet.id,
        name: planet.name,
        host: planet.host,
        orbit: planet.orbit || null,
        physical: planet.physical || null,
        discovery: planet.discovery || null,
        orbitalState: orbitalStateFor(planet, options.targetJulianDate, options.orbitOverridesByPlanetId),
        provenance: planet.provenance || null,
        existenceEvidence: classifyAstronomicalExistence(planet),
      });
    } else {
      candidatePlanetHosts.push({
        planetId: planet.id || key,
        planetName: planet.name || null,
        hostName: planet.host?.name || null,
        status: link?.status || 'unresolved-host',
        candidateStarSystemId: link?.host ? systems.find((system) => system.sourceRecordIds.includes(link.host))?.id || null : null,
        automaticAttachment: false,
        existenceEvidence: classifyAstronomicalExistence(planet),
      });
    }
  });

  const { canonicalRecords: _canonicalRecords, ...catalogIntegritySummary } = catalogIntegrity;
  return {
    schemaVersion: 1,
    engine: 'Gobai StarSystemEngine',
    targetEpochJulianYear: isFiniteValue(options.targetEpochJulianYear) ? Number(options.targetEpochJulianYear) : null,
    targetJulianDate: isFiniteValue(options.targetJulianDate) ? Number(options.targetJulianDate) : null,
    systems,
    candidatePlanetHosts,
    crossReferences: graph,
    catalogIntegrity: catalogIntegritySummary,
    statistics: {
      inputRecords: records.filter(Boolean).length,
      canonicalRecords: canonicalRecords.length,
      exactDuplicateRecordsRemoved: catalogIntegrity.statistics.exactDuplicateRecordsRemoved,
      starSystems: systems.length,
      verifiedSystems: systems.filter((system) => system.identityStatus === 'verified-gaia-identity').length,
      attachedExoplanets: systems.reduce((sum, system) => sum + system.planets.length, 0),
      candidateOrUnresolvedPlanets: candidatePlanetHosts.length,
      calculatedOrbits: systems.reduce((sum, system) => sum + system.planets.filter((planet) => planet.orbitalState.status === 'calculated').length, 0),
    },
  };
}

/** Façade d'intégration du catalogue TAP au modèle de systèmes stellaires. */
export class StarSystemEngine {
  constructor({ catalogService } = {}) {
    if (!catalogService || typeof catalogService.resolveCrossReferences !== 'function') {
      throw new TypeError('catalogService doit exposer resolveCrossReferences().');
    }
    this.catalogService = catalogService;
  }

  build(records, options = {}) {
    return buildStarSystems(records, options);
  }

  async resolveByName(name, options = {}, { signal } = {}) {
    const result = await this.catalogService.resolveCrossReferences({
      name,
      gaiaSourceId: options.gaiaSourceId ?? null,
      coordinates: options.coordinates ?? null,
      includeExoplanets: options.includeExoplanets ?? true,
      coordinateToleranceArcsec: options.coordinateToleranceArcsec ?? 1,
    }, { signal });
    return { ...this.build(result.records, options), catalog: { queryCount: result.queryCount, retrievedAt: result.retrievedAt } };
  }
}

export function createStarSystemEngine(options) { return new StarSystemEngine(options); }
