import { LOAD_STATE } from './PerivolumeManager.js';

/** Cadence les moteurs spécialisés sans détruire leurs objets ni leurs ressources. */
export class EngineActivityPolicy {
  constructor({ profiles = {} } = {}) {
    this.profiles = Object.freeze({
      atmosphere: { backgroundEvery: 4, ...(profiles.atmosphere || {}) },
      lidar: { backgroundEvery: 3, ...(profiles.lidar || {}) },
      lidarPoints: { backgroundEvery: 3, ...(profiles.lidarPoints || {}) },
      volcanoes: { backgroundEvery: 4, ...(profiles.volcanoes || {}) },
      earthLabels: { backgroundEvery: 2, ...(profiles.earthLabels || {}) },
      moonLabels: { backgroundEvery: 2, ...(profiles.moonLabels || {}) },
    });
    for (const [name, profile] of Object.entries(this.profiles)) {
      if (!Number.isInteger(profile.backgroundEvery) || profile.backgroundEvery < 1) {
        throw new RangeError(`backgroundEvery invalide pour ${name}.`);
      }
    }
    this.frame = 0;
  }

  beginFrame() { this.frame += 1; return this.frame; }

  shouldUpdate(engine, { state = LOAD_STATE.UNLOADED, focused = false } = {}) {
    if (focused || state === LOAD_STATE.ACTIVE) return true;
    if (state !== LOAD_STATE.BACKGROUND) return false;
    const profile = this.profiles[engine];
    if (!profile) throw new RangeError(`Moteur spécialisé inconnu : ${engine}.`);
    return this.frame > 0 && this.frame % profile.backgroundEvery === 0;
  }

  getCadence(engine) {
    const profile = this.profiles[engine];
    if (!profile) throw new RangeError(`Moteur spécialisé inconnu : ${engine}.`);
    return profile.backgroundEvery;
  }

  reset() { this.frame = 0; }
}
