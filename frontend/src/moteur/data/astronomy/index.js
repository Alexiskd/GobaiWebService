/** Couche de données astronomiques externes de Gobai Space. */
export * from './providers/index.js';

export { angularSeparationArcsec, resolveAstronomicalCrossReferences } from './providers/AstronomicalCrossReferenceResolver.js';

export {
  ASTROMETRIC_ENGINE_CONSTANTS,
  propagateAstrometricCoordinates,
  propagateAstrometricRecord,
  propagateAstrometricBatch,
} from './astrometry/AstrometricEngine.js';

export {
  EXOPLANET_ORBITAL_CONSTANTS,
  solveKeplerEquation,
  calculateExoplanetPosition,
  calculateExoplanetRecordPosition,
  calculateExoplanetBatch,
} from './orbits/ExoplanetOrbitalEngine.js';

export {
  StarSystemEngine,
  createStarSystemEngine,
  buildStarSystems,
} from '../../engine/star/StarSystemEngine.js';

export { mapStarSystemForPersistence, mapPositionSample, PostgresAstronomicalRepository, createPostgresAstronomicalRepository } from './persistence/index.js';

export { validateAstronomicalPipeline, assertAstronomicalPipelineValid } from './validation/AstronomicalValidationSuite.js';

export { AstronomicalSystemExplorer, createAstronomicalSystemExplorer } from './AstronomicalSystemExplorer.js';
