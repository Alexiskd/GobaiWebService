import { LOAD_STATE } from '../../PerivolumeEngine/PerivolumeManager.js';
import { applyPerivolumeAxioms } from '../../PerivolumeEngine/PerivolumeAxiomPolicy.js';

const PROFILE_ACTIVE = Object.freeze({ state: LOAD_STATE.ACTIVE, render: true, update: true, priority: 100 });
const PROFILE_BACKGROUND = Object.freeze({ state: LOAD_STATE.BACKGROUND, render: true, update: false, priority: 20 });
const PROFILE_UNLOADED = Object.freeze({ state: LOAD_STATE.UNLOADED, render: false, update: false, priority: 0 });

/** Orchestre les transitions de chargement sans dépendre de Three.js ni de React. */
export class SystemManager {
  constructor({ registry, perivolumeManager, onTransition, axioms = [] } = {}) {
    if (!registry || !perivolumeManager) throw new TypeError('registry et perivolumeManager sont requis.');
    this.registry = registry;
    this.perivolumeManager = perivolumeManager;
    this.onTransition = typeof onTransition === 'function' ? onTransition : null;
    this.axioms = axioms;
    this.effectiveStates = new Map();
  }

  update(cameraPosition) {
    const geometricDecisions = this.perivolumeManager.evaluate(cameraPosition);
    const decisions = applyPerivolumeAxioms(geometricDecisions, this.axioms);
    for (const decision of decisions) {
      const previousEffective = this.effectiveStates.get(decision.id) ?? decision.previous;
      decision.previous = previousEffective;
      decision.changed = previousEffective !== decision.state;
      this.effectiveStates.set(decision.id, decision.state);
      if (!decision.changed) continue;
      const system = this.registry.get(decision.id);
      this.onTransition?.({ system, ...decision });
    }
    return decisions;
  }

  unregister(id) {
    this.effectiveStates.delete(id);
    return true;
  }

  // Profils partagés et figés : interrogés plusieurs fois par image, ils ne créent plus d'objet à chaque appel.
  getLoadProfile(id) {
    const state = this.effectiveStates.get(id) ?? this.perivolumeManager.getState(id);
    if (state === LOAD_STATE.ACTIVE) return PROFILE_ACTIVE;
    if (state === LOAD_STATE.BACKGROUND) return PROFILE_BACKGROUND;
    if (state && state !== LOAD_STATE.UNLOADED) return Object.freeze({ state, render: false, update: false, priority: 0 });
    return PROFILE_UNLOADED;
  }
}
