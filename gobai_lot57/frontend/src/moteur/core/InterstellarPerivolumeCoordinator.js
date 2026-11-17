import { PerivolumeManager, LOAD_STATE } from './PerivolumeManager.js';
import { createGobaiPerivolumeAxioms, applyPerivolumeAxioms } from './PerivolumeAxiomPolicy.js';

const vector3 = (value) => Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite);

/** Applique les états ACTIVE/BACKGROUND/UNLOADED aux groupes Three.js sans détruire les ressources. */
export class InterstellarPerivolumeCoordinator {
  constructor({ hysteresis = 0.08, axioms = createGobaiPerivolumeAxioms(), onTransition = null } = {}) {
    this.manager = new PerivolumeManager({ hysteresis });
    this.axioms = axioms;
    this.groups = new Map();
    this.effectiveStates = new Map();
    this.onTransition = typeof onTransition === 'function' ? onTransition : null;
  }
  register({ id, center, radius, backgroundRadius = radius * 3, group = null, metadata = {} } = {}) {
    if (!vector3(center)) throw new TypeError('center doit être un vecteur 3D fini.');
    const entry = this.manager.register({ id, center, radius, backgroundRadius, metadata });
    if (group) this.groups.set(id, group);
    return entry;
  }
  attachGroup(id, group) { if (!this.manager.get(id) || !group) return false; this.groups.set(id, group); return true; }
  updateCenter(id, center) { return this.manager.updateCenter(id, center); }
  unregister(id) { this.groups.delete(id); this.effectiveStates.delete(id); return this.manager.unregister(id); }
  update(cameraPosition) {
    const geometric = this.manager.evaluate(cameraPosition);
    const decisions = applyPerivolumeAxioms(geometric, this.axioms);
    for (const decision of decisions) {
      const previous = this.effectiveStates.get(decision.id) ?? decision.previous;
      decision.previous = previous;
      decision.changed = previous !== decision.state;
      this.effectiveStates.set(decision.id, decision.state);
      const group = this.groups.get(decision.id);
      if (group) {
        group.visible = decision.state !== LOAD_STATE.UNLOADED;
        group.userData ||= {};
        group.userData.perivolumeState = decision.state;
        group.userData.perivolumePriority = decision.state === LOAD_STATE.ACTIVE ? 100 : decision.state === LOAD_STATE.BACKGROUND ? 20 : 0;
        group.userData.simulationPaused = decision.state !== LOAD_STATE.ACTIVE;
      }
      if (decision.changed) this.onTransition?.({ ...decision, group: group || null });
    }
    return decisions;
  }
  getState(id) { return this.effectiveStates.get(id) ?? this.manager.getState(id); }
  getProfile(id) {
    const state = this.getState(id);
    return { state, visible: state === LOAD_STATE.ACTIVE || state === LOAD_STATE.BACKGROUND,
      update: state === LOAD_STATE.ACTIVE, priority: state === LOAD_STATE.ACTIVE ? 100 : state === LOAD_STATE.BACKGROUND ? 20 : 0 };
  }
  clear() { this.manager.clear(); this.groups.clear(); this.effectiveStates.clear(); }
}

export function createInterstellarPerivolumeCoordinator(options) { return new InterstellarPerivolumeCoordinator(options); }
