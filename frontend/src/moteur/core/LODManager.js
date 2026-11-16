import { bodyLevel, planTiledBodies, satelliteShown } from '../engine/bodyLoading.jsx';

/**
 * Adaptateur central du LOD Gobai. Les décisions géométriques restent dans bodyLoading.jsx :
 * ce gestionnaire coordonne leur application sans dupliquer les seuils ni les formules.
 */
export class LODManager {
  #satelliteVisibility = new Map();

  constructor({ maxTiledBodies = 3 } = {}) {
    if (!Number.isInteger(maxTiledBodies) || maxTiledBodies < 1) {
      throw new RangeError('maxTiledBodies doit être un entier supérieur ou égal à 1.');
    }
    this.maxTiledBodies = maxTiledBodies;
    this.tick = 0;
  }

  evaluateBodies(bodies, { tick = this.tick++ } = {}) {
    if (!Array.isArray(bodies)) throw new TypeError('bodies doit être un tableau.');
    const candidates = bodies.map((body) => {
      if (!body || typeof body.id !== 'string' || !body.id) {
        throw new TypeError('Chaque astre doit posséder un id non vide.');
      }
      if (!Number.isFinite(body.px) || body.px < 0) {
        throw new RangeError(`px doit être un nombre positif ou nul pour ${body.id}.`);
      }
      const level = bodyLevel({ px: body.px, inView: Boolean(body.inView), focused: Boolean(body.focused) });
      return { ...body, level };
    });
    const tiled = planTiledBodies(candidates, this.maxTiledBodies, tick);
    return {
      tick,
      candidates,
      tiled,
      byId: new Map(candidates.map((body) => [body.id, body.level])),
    };
  }

  evaluateSatellite({ id, orbitPx, focused = false }) {
    if (typeof id !== 'string' || !id) throw new TypeError('id satellite requis.');
    if (!Number.isFinite(orbitPx) || orbitPx < 0) throw new RangeError('orbitPx doit être un nombre positif ou nul.');
    const shown = satelliteShown({
      orbitPx,
      focused,
      shown: this.#satelliteVisibility.get(id) ?? false,
    });
    this.#satelliteVisibility.set(id, shown);
    return shown;
  }

  forgetSatellite(id) { return this.#satelliteVisibility.delete(id); }
  clear() { this.#satelliteVisibility.clear(); this.tick = 0; }
}
