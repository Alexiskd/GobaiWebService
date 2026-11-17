import { buildStarSystems, createStarSystemEngine } from '../../engine/star/StarSystemEngine.js';
import { buildExoplanetSceneModel, createExoplanetSystemGroup } from '../../engine/exoplanets/ExoplanetSceneEngine.js';

function assembleSystems(records, options = {}, catalog = {}) {
  const identityCandidates = records.filter((record) => record?.source === 'CDS SIMBAD');
  const hasGaiaIdentity = records.some((record) => record?.source === 'ESA Gaia DR3');
  // SIMBAD par coordonnées reste une piste à vérifier : ne pas fusionner avec Gaia sans identifiant commun.
  const modelRecords = hasGaiaIdentity ? records.filter((record) => record?.source !== 'CDS SIMBAD') : records;
  const model = buildStarSystems(modelRecords, options);
  return {
    ...model,
    scenes: model.systems.map((item) => buildExoplanetSceneModel(item, options)),
    catalog: { ...catalog, identityCandidates },
  };
}

/**
 * Découverte de systèmes exoplanétaires à partir de Gaia + NASA, enrichie par SIMBAD.
 * Les requêtes TAP sont publiques ; pour un déploiement de production, un proxy backend
 * est préférable si l'origine du site ne permet pas les appels CORS vers les archives.
 */
export class AstronomicalSystemExplorer {
  constructor({ catalogService, starSystemEngine = null } = {}) {
    if (!catalogService) throw new TypeError('catalogService est requis.');
    this.catalog = catalogService;
    this.starEngine = starSystemEngine || createStarSystemEngine({ catalogService });
  }

  async resolveByName(name, options = {}, { signal } = {}) {
    const resolved = await this.catalog.resolveCrossReferences({
      name,
      gaiaSourceId: options.gaiaSourceId ?? null,
      coordinates: options.coordinates ?? null,
      includeExoplanets: options.includeExoplanets ?? true,
      coordinateToleranceArcsec: options.coordinateToleranceArcsec ?? 1,
    }, { signal });
    let records = [...resolved.records];
    let coordinateDiscoveryCount = 0;
    const namedObject = records.find((record) => record?.source === 'CDS SIMBAD' && Number.isFinite(record.coordinates?.raDeg) && Number.isFinite(record.coordinates?.decDeg));
    if (namedObject && options.discoverAroundResolvedName !== false) {
      const nearby = await this.catalog.searchExoplanetSystemsCone({
        raDeg: namedObject.coordinates.raDeg,
        decDeg: namedObject.coordinates.decDeg,
        radiusDeg: options.nameSearchRadiusDeg ?? 0.05,
        limit: options.limit ?? 50,
      }, { signal }).catch(() => ({ records: [] }));
      records.push(...nearby.records);
      coordinateDiscoveryCount = 1;
    }
    const gaiaIds = [...new Set(records.map((record) => record?.host?.gaiaDr3Id).filter((id) => id && /^\d+$/.test(id)))];
    const gaiaResults = await Promise.all(gaiaIds.slice(0, 20).map((id) => this.catalog.findGaiaSource(id, { signal }).catch(() => ({ records: [] }))));
    return assembleSystems([...records, ...gaiaResults.flatMap((item) => item.records)], options, { queryCount: resolved.queryCount + coordinateDiscoveryCount + gaiaResults.length, retrievedAt: resolved.retrievedAt });
  }

  async resolveByGaiaId(gaiaSourceId, options = {}, { signal } = {}) {
    const host = await this.catalog.findGaiaSource(gaiaSourceId, { signal });
    const planets = await this.catalog.findExoplanetsByGaiaHostId(gaiaSourceId, { signal, limit: options.limit });
    const records = [...host.records, ...planets.records];
    if (options.includeSimbad !== false && host.records[0]?.coordinates) {
      const { raDeg, decDeg } = host.records[0].coordinates;
      const simbad = await this.catalog.searchSimbadCone({ raDeg, decDeg, radiusDeg: options.simbadRadiusDeg ?? 0.001, limit: 10 }, { signal }).catch(() => ({ records: [] }));
      records.push(...simbad.records);
    }
    return assembleSystems(records, options, { providers: ['ESA Gaia DR3', 'NASA Exoplanet Archive', 'CDS SIMBAD'] });
  }

  async searchSystemsInCone({ raDeg, decDeg, radiusDeg = 5, limit = 100, ...options } = {}, { signal } = {}) {
    const [gaia, exoplanets] = await Promise.all([
      this.catalog.searchGaiaCone({ raDeg, decDeg, radiusDeg: Math.min(radiusDeg, 5), limit }, { signal }),
      this.catalog.searchExoplanetSystemsCone({ raDeg, decDeg, radiusDeg, limit }, { signal }),
    ]);
    const knownGaiaIds = new Set(gaia.records.map((record) => record.sourceId).filter(Boolean));
    const missingGaiaIds = [...new Set(exoplanets.records.map((record) => record.host?.gaiaDr3Id).filter((id) => id && /^\d+$/.test(id) && !knownGaiaIds.has(id)))];
    const supplementalGaia = await Promise.all(missingGaiaIds.slice(0, 50).map((id) => this.catalog.findGaiaSource(id, { signal }).catch(() => ({ records: [] }))));
    const supplementalRecords = supplementalGaia.flatMap((item) => item.records);
    const records = [...gaia.records, ...supplementalRecords, ...exoplanets.records];
    const model = buildStarSystems(records, options);
    const scenes = model.systems.map((item) => buildExoplanetSceneModel(item, options));
    return {
      ...model,
      scenes,
      catalog: {
        providers: ['ESA Gaia DR3', 'NASA Exoplanet Archive'],
        gaiaCount: gaia.records.length + supplementalRecords.length,
        supplementalGaiaCount: supplementalRecords.length,
        exoplanetCount: exoplanets.records.length,
        retrievedAt: new Date().toISOString(),
      },
    };
  }

  async listKnownSystems({ limit = 100, ...options } = {}, { signal } = {}) {
    const result = await this.catalog.listKnownExoplanets({ signal, limit });
    const gaiaIds = [...new Set(result.records.map((record) => record.host?.gaiaDr3Id).filter((id) => id && /^\d+$/.test(id)))];
    const starResults = await Promise.all(gaiaIds.slice(0, 50).map((id) => this.catalog.findGaiaSource(id, { signal }).catch(() => ({ records: [] }))));
    const records = [...starResults.flatMap((item) => item.records), ...result.records];
    const model = buildStarSystems(records, options);
    return {
      ...model,
      scenes: model.systems.map((item) => buildExoplanetSceneModel(item, options)),
      catalog: { providers: ['ESA Gaia DR3', 'NASA Exoplanet Archive'], exoplanetCount: result.records.length, gaiaHostsResolved: starResults.filter((item) => item.records.length).length, retrievedAt: result.retrievedAt },
    };
  }

  buildScene(starSystem, options = {}) { return buildExoplanetSceneModel(starSystem, options); }
  createThreeGroup(THREE, starSystem, options = {}) {
    return createExoplanetSystemGroup(THREE, this.buildScene(starSystem, options), options);
  }
}

export function createAstronomicalSystemExplorer(options) { return new AstronomicalSystemExplorer(options); }
