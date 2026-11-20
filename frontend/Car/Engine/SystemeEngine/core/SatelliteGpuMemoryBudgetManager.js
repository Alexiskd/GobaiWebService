const BODY_STATES = Object.freeze({ ACTIVE: 3, BACKGROUND: 1, UNLOADED: 0 });

function finiteNonNegative(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new RangeError(`${label} doit être un nombre fini positif ou nul.`);
  return Math.floor(number);
}

/**
 * Budget GPU logique pour les ressources de surface (atlas, textures, buffers).
 * Le gestionnaire ne crée aucune ressource WebGL : chaque entrée fournit un
 * callback evict() qui doit libérer proprement sa ressource côté propriétaire.
 */
export class SatelliteGpuMemoryBudgetManager {
  constructor({ globalBudgetBytes = 512 * 1024 * 1024, defaultBodyBudgetBytes = 256 * 1024 * 1024, onEvict, onBudgetExceeded } = {}) {
    this.globalBudgetBytes = finiteNonNegative(globalBudgetBytes, 'globalBudgetBytes');
    this.defaultBodyBudgetBytes = finiteNonNegative(defaultBodyBudgetBytes, 'defaultBodyBudgetBytes');
    this.onEvict = typeof onEvict === 'function' ? onEvict : null;
    this.onBudgetExceeded = typeof onBudgetExceeded === 'function' ? onBudgetExceeded : null;
    this.resources = new Map();
    this.bodyBudgets = new Map();
    this.bodyStates = new Map();
    this.sequence = 0;
    this.disposed = false;
  }

  setGlobalBudget(bytes) {
    this.#assertAlive();
    this.globalBudgetBytes = finiteNonNegative(bytes, 'bytes');
    return this.enforceBudgets();
  }

  setBodyBudget(bodyId, bytes) {
    this.#assertBodyId(bodyId);
    this.#assertAlive();
    this.bodyBudgets.set(bodyId, finiteNonNegative(bytes, 'bytes'));
    return this.enforceBudgets(bodyId);
  }

  setBodyState(bodyId, state) {
    this.#assertBodyId(bodyId);
    this.#assertAlive();
    if (!(state in BODY_STATES)) throw new TypeError(`État d'astre inconnu : ${state}`);
    this.bodyStates.set(bodyId, state);
  }

  /** Synchronise les états renvoyés par PerivolumeManager.evaluate(). */
  syncPerivolumeDecisions(decisions = []) {
    this.#assertAlive();
    if (!Array.isArray(decisions)) throw new TypeError('decisions doit être un tableau.');
    const synced = [];
    for (const decision of decisions) {
      if (!decision || typeof decision.id !== 'string' || !(decision.state in BODY_STATES)) {
        throw new TypeError('Chaque décision doit contenir un id et un état de périvolume valide.');
      }
      this.setBodyState(decision.id, decision.state);
      synced.push(decision.id);
    }
    return synced;
  }

  /** Enregistre une ressource et tente de faire respecter les budgets. */
  register({ id, bodyId, bytes, priority = 0, pinned = false, evict, metadata = null }) {
    this.#assertAlive();
    if (typeof id !== 'string' || !id.trim()) throw new TypeError('id doit être une chaîne non vide.');
    this.#assertBodyId(bodyId);
    if (this.resources.has(id)) throw new Error(`Ressource GPU déjà enregistrée : ${id}`);
    if (typeof evict !== 'function') throw new TypeError('Chaque ressource doit fournir un callback evict().');
    const size = finiteNonNegative(bytes, 'bytes');
    const p = Number(priority);
    if (!Number.isFinite(p)) throw new TypeError('priority doit être fini.');
    const resource = { id, bodyId, bytes: size, priority: p, pinned: Boolean(pinned), evict, metadata, lastUsed: ++this.sequence };
    this.resources.set(id, resource);
    const result = this.enforceBudgets(bodyId);
    if (!this.resources.has(id)) return { accepted: false, reason: 'budget-exceeded', evicted: result.evicted };
    return { accepted: true, evicted: result.evicted, resource: this.#snapshot(resource) };
  }

  touch(id) {
    this.#assertAlive();
    const resource = this.resources.get(id);
    if (!resource) return false;
    resource.lastUsed = ++this.sequence;
    return true;
  }

  pin(id) {
    this.#assertAlive();
    const resource = this.resources.get(id);
    if (!resource) return false;
    resource.pinned = true;
    resource.lastUsed = ++this.sequence;
    return true;
  }

  unpin(id) {
    this.#assertAlive();
    const resource = this.resources.get(id);
    if (!resource) return false;
    resource.pinned = false;
    this.enforceBudgets(resource.bodyId);
    return true;
  }

  /** Retire une ressource connue sans appeler son callback (déjà détruite). */
  forget(id) {
    this.#assertAlive();
    return this.resources.delete(id);
  }

  /**
   * Éviction LRU jusqu'au respect du budget global et du budget d'un astre.
   * Les ressources épinglées ne sont jamais évincées. En cas d'échec du
   * callback, l'entrée reste comptabilisée et le gestionnaire essaie la suite.
   */
  enforceBudgets(focusBodyId = null) {
    this.#assertAlive();
    const evicted = [];
    const failed = [];
    let guard = this.resources.size + 1;
    while (guard-- > 0) {
      const overGlobal = this.#totalBytes() > this.globalBudgetBytes;
      const bodyIds = new Set([...this.resources.values()].map((resource) => resource.bodyId));
      for (const id of this.bodyBudgets.keys()) bodyIds.add(id);
      const overBodies = [...bodyIds].filter((id) => this.#bodyBytes(id) > (this.bodyBudgets.get(id) ?? this.defaultBodyBudgetBytes));
      if (!overGlobal && overBodies.length === 0) break;
      // Une limite par astre est traitée avant la limite globale : on ne sacrifie
      // pas une autre planète pour résoudre le dépassement local d'une planète.
      const constrainedBodies = overBodies.length ? new Set(overBodies) : null;
      const candidates = [...this.resources.values()].filter((resource) => !resource.pinned
        && !failed.includes(resource.id)
        && (!constrainedBodies || constrainedBodies.has(resource.bodyId)));
      if (!candidates.length) break;
      candidates.sort((a, b) => {
        const stateDelta = (BODY_STATES[this.bodyStates.get(a.bodyId) ?? 'BACKGROUND']) - (BODY_STATES[this.bodyStates.get(b.bodyId) ?? 'BACKGROUND']);
        return stateDelta || a.priority - b.priority || a.lastUsed - b.lastUsed;
      });
      const candidate = candidates[0];
      try {
        const result = candidate.evict({ id: candidate.id, bodyId: candidate.bodyId, bytes: candidate.bytes, metadata: candidate.metadata });
        if (result === false) {
          failed.push(candidate.id);
          continue;
        }
        this.resources.delete(candidate.id);
        evicted.push(candidate.id);
        this.onEvict?.(this.#snapshot(candidate));
      } catch (error) {
        failed.push(candidate.id);
        this.onBudgetExceeded?.({ reason: 'eviction-error', resource: this.#snapshot(candidate), error });
      }
    }
    const checkedBodies = new Set([...this.resources.values()].map((resource) => resource.bodyId));
    for (const id of this.bodyBudgets.keys()) checkedBodies.add(id);
    const withinBudget = this.#totalBytes() <= this.globalBudgetBytes
      && [...checkedBodies].every((id) => this.#bodyBytes(id) <= (this.bodyBudgets.get(id) ?? this.defaultBodyBudgetBytes))
      && (focusBodyId === null || this.#bodyBytes(focusBodyId) <= (this.bodyBudgets.get(focusBodyId) ?? this.defaultBodyBudgetBytes));
    if (!withinBudget) this.onBudgetExceeded?.({ reason: 'pinned-or-unavailable-resources', stats: this.getStats() });
    return { withinBudget, evicted, failed };
  }

  getStats() {
    const byBody = {};
    for (const resource of this.resources.values()) {
      byBody[resource.bodyId] ||= { resourceCount: 0, bytes: 0, pinnedBytes: 0, budgetBytes: this.bodyBudgets.get(resource.bodyId) ?? this.defaultBodyBudgetBytes };
      const row = byBody[resource.bodyId];
      row.resourceCount += 1;
      row.bytes += resource.bytes;
      if (resource.pinned) row.pinnedBytes += resource.bytes;
    }
    return Object.freeze({
      globalBudgetBytes: this.globalBudgetBytes,
      usedBytes: this.#totalBytes(),
      remainingBytes: Math.max(0, this.globalBudgetBytes - this.#totalBytes()),
      resourceCount: this.resources.size,
      pinnedBytes: [...this.resources.values()].filter((resource) => resource.pinned).reduce((sum, resource) => sum + resource.bytes, 0),
      byBody: Object.freeze(Object.fromEntries(Object.entries(byBody).map(([id, value]) => [id, Object.freeze(value)]))),
      disposed: this.disposed,
    });
  }

  dispose({ evictResources = false } = {}) {
    if (this.disposed) return;
    if (evictResources) {
      for (const resource of [...this.resources.values()]) {
        try { resource.evict({ id: resource.id, bodyId: resource.bodyId, bytes: resource.bytes, metadata: resource.metadata }); }
        catch (error) { this.onBudgetExceeded?.({ reason: 'dispose-error', resource: this.#snapshot(resource), error }); }
      }
    }
    this.resources.clear();
    this.bodyBudgets.clear();
    this.bodyStates.clear();
    this.disposed = true;
  }

  #totalBytes() { let total = 0; for (const resource of this.resources.values()) total += resource.bytes; return total; }
  #bodyBytes(bodyId) { let total = 0; for (const resource of this.resources.values()) if (resource.bodyId === bodyId) total += resource.bytes; return total; }
  #snapshot(resource) { return Object.freeze({ id: resource.id, bodyId: resource.bodyId, bytes: resource.bytes, priority: resource.priority, pinned: resource.pinned, lastUsed: resource.lastUsed, metadata: resource.metadata }); }
  #assertBodyId(bodyId) { if (typeof bodyId !== 'string' || !bodyId.trim()) throw new TypeError('bodyId doit être une chaîne non vide.'); }
  #assertAlive() { if (this.disposed) throw new Error('SatelliteGpuMemoryBudgetManager est déjà libéré.'); }
}

export const SATELLITE_GPU_BODY_STATES = BODY_STATES;
