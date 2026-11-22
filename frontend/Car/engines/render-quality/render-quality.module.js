/**
 * Module de qualité du rendu : assemble le service et ses briques (metrics/ au lot 1 ; profiles/ et thermal/
 * aux lots suivants). Chaque moteur 3D crée son module une fois, à sa création, et le libère à sa destruction.
 */

// Importe le service.
import { RenderQualityService } from './render-quality.service.js';

/**
 * Crée le module de qualité du rendu.
 * @param {object} [options] dépendances injectables (tests) : `frameWindow`.
 * @returns {{ service: RenderQualityService, dispose: () => void }}
 */
export function createRenderQualityModule(options = {}) {
  // Le service, avec ses dépendances.
  const service = new RenderQualityService(options);
  // Le module : le service et sa libération.
  return {
    // Le service.
    service,
    // Libère le service.
    dispose: () => service.dispose(),
  // Fin du module.
  };
// Fin de createRenderQualityModule.
}
