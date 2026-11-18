import { LOAD_STATE } from './PerivolumeManager.js';

/**
 * Traduit les états du périvolume en cadence de travail pour les moteurs coûteux.
 * Les objets déjà présents dans la scène restent visibles : cette politique ne
 * modifie ni la visibilité Three.js, ni les données orbitales, ni les ressources.
 */
export class CoreActivityPolicy {
  constructor({ backgroundEvery = 4 } = {}) {
    if (!Number.isInteger(backgroundEvery) || backgroundEvery < 1) {
      throw new RangeError('backgroundEvery doit être un entier supérieur ou égal à 1.');
    }
    this.backgroundEvery = backgroundEvery;
    this.frame = 0;
  }

  beginFrame() { this.frame += 1; return this.frame; }

  shouldUpdateTiles({ state = LOAD_STATE.UNLOADED, focused = false } = {}) {
    if (focused || state === LOAD_STATE.ACTIVE) return true;
    if (state === LOAD_STATE.BACKGROUND) return this.frame % this.backgroundEvery === 0;
    return false;
  }

  getCadence(state) {
    if (state === LOAD_STATE.ACTIVE) return 1;
    if (state === LOAD_STATE.BACKGROUND) return this.backgroundEvery;
    return 0;
  }

  reset() { this.frame = 0; }
}
