/** Couche de données astronomiques externes de Gobai Space. */
export * from './providers/index.js';

export { angularSeparationArcsec, resolveAstronomicalCrossReferences } from './providers/AstronomicalCrossReferenceResolver.js';

export {
  ASTROMETRIC_ENGINE_CONSTANTS,
  propagateAstrometricCoordinates,
  propagateAstrometricRecord,
  propagateAstrometricBatch,
  buildGaiaAstrometricCovariance,
  gaiaDR3RowToAstrometricRecord,
  propagateAstrometricPositionCovariance,
} from './astrometry/AstrometricEngine.js';

export {
  PROXIMA_CENTAURI_ASTROMETRY,
  createProximaCentauriAstrometricRecord,
  calculateProximaCentauriPosition,
  propagateProximaCentauriRecord,
} from './astrometry/ProximaCentauriAstrometry.js';
export { createProximaCentauriIllustrativeSystem } from './astrometry/ProximaCentauriIllustrativeSystem.js';

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

export {
  icrsToHeliocentricParsecs,
  icrsParsecsToScene,
  buildInterstellarSystemModel,
  createInterstellarSystemGroup,
  InterstellarSceneRenderer,
  createInterstellarSceneRenderer,
} from '../../engine/star/InterstellarSceneRenderer.js';

export {
  PARSEC_IN_AU,
  INTERSTELLAR_OVERVIEW_AU_PER_PC,
  INTERSTELLAR_DISTANCE_COMPRESSION,
  createInterstellarEngineConfig,
  globalCameraPosition,
  resolveInterstellarSystemId,
  resolveInterstellarPerivolumeRadius,
  resolveInterstellarFocusDistance,
} from '../../engine/star/InterstellarEngineIntegration.js';

export { GalacticSpatialIndex, createGalacticSpatialIndex } from '../../core/GalacticSpatialIndex.js';

export { GalacticSectorStreamingManager, createGalacticSectorStreamingManager } from '../../core/GalacticSectorStreamingManager.js';

export { GaiaSectorCache, createGaiaSectorCache } from './providers/GaiaSectorCache.js';
export { GaiaDR3SectorStreamer, createGaiaDR3SectorStreamer, gaiaRecordToHeliocentricParsecs } from './providers/GaiaDR3SectorStreamer.js';
export { GaiaStarfieldLayer } from '../../engine/star/GaiaStarfieldLayer.js';

export { GalacticSectorScheduler, createGalacticSectorScheduler } from '../../core/GalacticSectorScheduler.js';
