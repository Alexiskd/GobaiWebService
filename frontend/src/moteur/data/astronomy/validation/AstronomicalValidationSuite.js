import { buildStarSystems } from '../../../engine/star/StarSystemEngine.js';
import { buildExoplanetSceneModel } from '../../../engine/exoplanets/ExoplanetSceneEngine.js';
import { mapStarSystemForPersistence, mapPositionSample } from '../persistence/AstronomicalPersistenceMapper.js';

const finite = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const check = (id, status, details = {}) => ({ id, status, ...details });

/**
 * Validation déterministe du pipeline données -> astrométrie/orbites -> scène -> mapping SQL.
 * Cette suite ne contacte aucun fournisseur et n'ouvre aucune connexion PostgreSQL.
 */
export function validateAstronomicalPipeline(records, options = {}) {
  const checks = [];
  if (!Array.isArray(records)) {
    return { schemaVersion: 1, engine: 'Gobai Astronomical Validation Suite', status: 'failed', checks: [check('input.records', 'failed', { message: 'records doit être un tableau.' })], statistics: { passed: 0, warnings: 0, failed: 1 } };
  }

  let built;
  try {
    built = buildStarSystems(records, {
      targetEpochJulianYear: options.targetEpochJulianYear,
      targetJulianDate: options.targetJulianDate,
      orbitOverridesByPlanetId: options.orbitOverridesByPlanetId,
    });
    checks.push(check('catalog.assembly', 'passed', { systems: built.systems.length, inputRecords: records.length }));
  } catch (error) {
    checks.push(check('catalog.assembly', 'failed', { message: error.message }));
    return summarize(checks);
  }

  const attached = built.systems.flatMap((system) => system.planets.map((planet) => ({ system, planet })));
  const unresolved = built.candidatePlanetHosts.length;
  checks.push(check('identity.gaia-linkage', unresolved === 0 ? 'passed' : 'warning', {
    verifiedSystems: built.statistics.verifiedSystems,
    attachedExoplanets: attached.length,
    unresolvedOrCandidateHosts: unresolved,
    policy: 'exact Gaia DR3 identifier only; coordinate/name matches are not automatic',
  }));

  const astrometry = built.systems.filter((system) => system.star?.coordinates).map((system) => system.star.coordinates);
  const invalidCoordinates = astrometry.filter((coordinates) => !finite(coordinates.raDeg) || Number(coordinates.raDeg) < 0 || Number(coordinates.raDeg) >= 360 || !finite(coordinates.decDeg) || Number(coordinates.decDeg) < -90 || Number(coordinates.decDeg) > 90);
  checks.push(check('astrometry.coordinate-domain', invalidCoordinates.length ? 'failed' : 'passed', {
    inspected: astrometry.length,
    invalid: invalidCoordinates.length,
    frame: 'ICRS',
  }));

  const calculated = attached.filter(({ planet }) => planet.orbitalState?.status === 'calculated');
  const invalidOrbitalStates = calculated.filter(({ planet }) => {
    const state = planet.orbitalState.position;
    return !state?.position || !['x', 'y', 'z'].every((axis) => finite(state.position[axis]))
      || state.solver?.converged !== true || !finite(state.solver?.residual) || Math.abs(Number(state.solver.residual)) > (options.maxKeplerResidual ?? 1e-9);
  });
  const unavailable = attached.length - calculated.length;
  checks.push(check('orbit.kepler-solutions', invalidOrbitalStates.length ? 'failed' : (unavailable ? 'warning' : 'passed'), {
    calculated: calculated.length,
    unavailable,
    invalid: invalidOrbitalStates.length,
    maxResidual: options.maxKeplerResidual ?? 1e-9,
  }));

  let sceneCount = 0;
  let sceneFailures = 0;
  const sceneModels = [];
  for (const system of built.systems) {
    try {
      const scene = buildExoplanetSceneModel(system, options.sceneOptions || {});
      sceneCount += 1;
      sceneModels.push({ system, scene });
      const invalidSceneData = scene.planets.some((planet) => planet.position && !['x', 'y', 'z'].every((axis) => finite(planet.position[axis])));
      if (invalidSceneData) sceneFailures += 1;
    } catch {
      sceneFailures += 1;
    }
  }
  checks.push(check('scene.model-generation', sceneFailures ? 'failed' : 'passed', {
    systemsInspected: sceneCount,
    failures: sceneFailures,
    frameConvention: 'ORBITAL-REFERENCE -> Gobai scene axes (x,z,-y), not ICRS',
  }));

  let persistenceFailures = 0;
  let mappedPlanets = 0;
  for (const system of built.systems) {
    try {
      const mapped = mapStarSystemForPersistence(system);
      mappedPlanets += mapped.planets.length;
      for (const planet of mapped.planets) {
        if (planet.hostStarCanonicalKey && planet.hostLinkStatus !== 'verified-gaia-id') persistenceFailures += 1;
      }
    } catch {
      persistenceFailures += 1;
    }
  }
  checks.push(check('persistence.mapping', persistenceFailures ? 'failed' : 'passed', {
    systemsMapped: built.systems.length,
    planetsMapped: mappedPlanets,
    databaseConnectionTested: false,
  }));

  let sampleCheck = 'warning';
  if (sceneModels.length) {
    const positioned = sceneModels.flatMap(({ system, scene }) => scene.planets.filter((planet) => planet.position).map((planet) => ({ system, planet })));
    if (positioned.length) {
      const first = positioned[0];
      try {
        mapPositionSample({
          objectKey: `${first.system.id}:${first.planet.id}`,
          epochJulianDate: options.targetJulianDate ?? first.system.targetJulianDate ?? 2451545,
          frame: 'GOBAI-SCENE',
          position: first.planet.position,
          units: 'scene units',
          source: 'Gobai ExoplanetSceneEngine',
          metadata: { sourceFrame: 'ORBITAL-REFERENCE', conversion: '(x,y,z) -> (x,z,-y)' },
        });
        sampleCheck = 'passed';
      } catch {
        sampleCheck = 'failed';
      }
    }
  }
  checks.push(check('persistence.position-sample-contract', sampleCheck, { frame: 'GOBAI-SCENE' }));
  checks.push(check('database.live-connectivity', 'warning', { tested: false, reason: 'Validation hors ligne : aucune connexion PostgreSQL n’est ouverte.' }));
  checks.push(check('provider.live-connectivity', 'warning', { tested: false, reason: 'Aucun appel réseau Gaia, SIMBAD ou NASA n’est effectué par cette suite.' }));
  return summarize(checks, { systems: built.statistics.starSystems, attachedExoplanets: built.statistics.attachedExoplanets, calculatedOrbits: built.statistics.calculatedOrbits });
}

function summarize(checks, statistics = {}) {
  const passed = checks.filter((item) => item.status === 'passed').length;
  const warnings = checks.filter((item) => item.status === 'warning').length;
  const failed = checks.filter((item) => item.status === 'failed').length;
  return {
    schemaVersion: 1,
    engine: 'Gobai Astronomical Validation Suite',
    status: failed ? 'failed' : (warnings ? 'passed-with-warnings' : 'passed'),
    checks,
    statistics: { ...statistics, passed, warnings, failed, total: checks.length },
  };
}

export function assertAstronomicalPipelineValid(records, options = {}) {
  const report = validateAstronomicalPipeline(records, options);
  if (report.status === 'failed') {
    const failures = report.checks.filter((item) => item.status === 'failed').map((item) => `${item.id}: ${item.message || item.failures || 'échec'}`);
    const error = new Error(`Validation astronomique échouée : ${failures.join('; ')}`);
    error.report = report;
    throw error;
  }
  return report;
}
