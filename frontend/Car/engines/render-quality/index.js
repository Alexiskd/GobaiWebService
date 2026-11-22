// Point d'entrée de l'engine render-quality : ce que les autres engines importent.

// Le module (création et libération).
export { createRenderQualityModule } from './render-quality.module.js';
// Le service (point d'entrée unique de la qualité du rendu).
export { RenderQualityService } from './render-quality.service.js';
// Le relevé vide, pour lire les mesures avant la première seconde.
export { EMPTY_METRICS } from './metrics/metricsSnapshot.js';
