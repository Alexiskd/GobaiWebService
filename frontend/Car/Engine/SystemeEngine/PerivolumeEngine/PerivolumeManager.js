/**
 * Détermine le niveau de travail d'un système/astre selon la distance caméra-centre.
 * Les distances sont exprimées dans la même unité que center et radius (à définir par l'appelant).
 * Ce module ne calcule pas de surface : un périvolume est ici une zone spatiale de proximité.
 */
export const LOAD_STATE = Object.freeze({ ACTIVE: 'ACTIVE', BACKGROUND: 'BACKGROUND', UNLOADED: 'UNLOADED' });

const finiteVector = (v) => Array.isArray(v) && v.length >= 3 && v.slice(0, 3).every(Number.isFinite);
const distance3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export class PerivolumeManager {
  #entries = new Map();
  #states = new Map();

  constructor({ hysteresis = 0.08 } = {}) {
    if (!Number.isFinite(hysteresis) || hysteresis < 0 || hysteresis >= 1) {
      throw new RangeError('hysteresis doit être compris entre 0 inclus et 1 exclu.');
    }
    this.hysteresis = hysteresis;
  }

  register({ id, center = [0, 0, 0], radius, backgroundRadius = radius * 3, metadata = {} }) {
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id requis.');
    if (!finiteVector(center)) throw new TypeError(`Centre invalide pour ${id}.`);
    if (!Number.isFinite(radius) || radius <= 0) throw new RangeError(`Rayon invalide pour ${id}.`);
    if (!Number.isFinite(backgroundRadius) || backgroundRadius < radius) {
      throw new RangeError(`backgroundRadius doit être supérieur ou égal au rayon pour ${id}.`);
    }
    this.#entries.set(id, { id, center: [...center.slice(0, 3)], radius, backgroundRadius, metadata });
    if (!this.#states.has(id)) this.#states.set(id, LOAD_STATE.UNLOADED);
    return this.get(id);
  }

  updateCenter(id, center) {
    const entry = this.#entries.get(id);
    if (!entry) return false;
    if (!finiteVector(center)) throw new TypeError(`Centre invalide pour ${id}.`);
    // Copie sur place, sans nouveau tableau : appelée à chaque image pour chaque astre.
    entry.center[0] = center[0]; entry.center[1] = center[1]; entry.center[2] = center[2];
    return true;
  }

  unregister(id) { this.#states.delete(id); return this.#entries.delete(id); }
  get(id) {
    const entry = this.#entries.get(id);
    return entry ? { ...entry, center: [...entry.center], state: this.#states.get(id) } : null;
  }

  evaluate(cameraPosition) {
    if (!finiteVector(cameraPosition)) throw new TypeError('cameraPosition doit être un vecteur 3D fini.');
    const decisions = [];
    for (const entry of this.#entries.values()) {
      const distance = distance3(cameraPosition, entry.center);
      const previous = this.#states.get(entry.id) ?? LOAD_STATE.UNLOADED;
      const margin = this.hysteresis;
      let next;
      if (previous === LOAD_STATE.ACTIVE) {
        next = distance <= entry.radius * (1 + margin)
          ? LOAD_STATE.ACTIVE
          : distance <= entry.backgroundRadius * (1 + margin)
            ? LOAD_STATE.BACKGROUND : LOAD_STATE.UNLOADED;
      } else if (previous === LOAD_STATE.BACKGROUND) {
        next = distance <= entry.radius * (1 - margin)
          ? LOAD_STATE.ACTIVE
          : distance <= entry.backgroundRadius * (1 + margin)
            ? LOAD_STATE.BACKGROUND : LOAD_STATE.UNLOADED;
      } else {
        next = distance <= entry.radius ? LOAD_STATE.ACTIVE
          : distance <= entry.backgroundRadius ? LOAD_STATE.BACKGROUND : LOAD_STATE.UNLOADED;
      }
      this.#states.set(entry.id, next);
      decisions.push({ id: entry.id, distance, radius: entry.radius, backgroundRadius: entry.backgroundRadius, previous, state: next, changed: previous !== next, metadata: entry.metadata });
    }
    return decisions;
  }

  getState(id) { return this.#states.get(id) ?? null; }
  clear() { this.#entries.clear(); this.#states.clear(); }
}
