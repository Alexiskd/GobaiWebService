import { SatelliteGpuMemoryBudgetManager } from './SatelliteGpuMemoryBudgetManager.js';

/**
 * Orchestration centrale du budget GPU des surfaces.
 * Le moteur possède le budget et les bridges explicitement enregistrés ;
 * les atlas restent propriétaires de leurs pages et textures.
 */
export class SatelliteGpuBudgetOrchestrator {
  constructor({ budgetManager, globalBudgetBytes = 512 * 1024 * 1024, defaultBodyBudgetBytes = 256 * 1024 * 1024, onError } = {}) {
    this.budgetManager = budgetManager || new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes, defaultBodyBudgetBytes });
    if (typeof this.budgetManager.syncPerivolumeDecisions !== 'function'
      || typeof this.budgetManager.enforceBudgets !== 'function'
      || typeof this.budgetManager.getStats !== 'function'
      || typeof this.budgetManager.dispose !== 'function') {
      throw new TypeError('budgetManager incompatible avec SatelliteGpuBudgetOrchestrator.');
    }
    this.onError = typeof onError === 'function' ? onError : null;
    this.bridges = new Set();
    this.lastEnforcement = { withinBudget: true, evicted: [], failed: [] };
    this.lastDecisions = [];
    this.disposed = false;
  }

  /** Enregistre un bridge et effectue une première réconciliation des pages. */
  registerBridge(bridge) {
    this.#assertAlive();
    if (!bridge || bridge.budgetManager !== this.budgetManager || typeof bridge.sync !== 'function'
      || typeof bridge.dispose !== 'function' || typeof bridge.syncPerivolumeDecisions !== 'function') {
      throw new TypeError('Le bridge doit utiliser le budget central et exposer sync()/dispose().');
    }
    if (this.bridges.has(bridge)) return () => this.unregisterBridge(bridge);
    this.bridges.add(bridge);
    try {
      bridge.syncPerivolumeDecisions(this.lastDecisions);
    } catch (error) {
      this.bridges.delete(bridge);
      this.onError?.(error, 'register-bridge');
      throw error;
    }
    return () => this.unregisterBridge(bridge);
  }

  /** Retire le bridge et ses inscriptions, sans détruire son atlas. */
  unregisterBridge(bridge) {
    this.#assertAlive();
    if (!this.bridges.delete(bridge)) return false;
    bridge.dispose();
    return true;
  }

  /** Applique les états de périvolume et fait respecter les budgets. */
  updatePerivolumeDecisions(decisions = []) {
    this.#assertAlive();
    if (!Array.isArray(decisions)) throw new TypeError('decisions doit être un tableau.');
    const nextDecisions = decisions.map(({ id, state }) => ({ id, state }));
    const previousStates = new Map(this.lastDecisions.map(({ id, state }) => [id, state]));
    const stateChanged = nextDecisions.length !== this.lastDecisions.length
      || nextDecisions.some(({ id, state }) => previousStates.get(id) !== state);
    this.lastDecisions = nextDecisions;
    if (stateChanged) {
      this.budgetManager.syncPerivolumeDecisions(this.lastDecisions);
      this.lastEnforcement = this.budgetManager.enforceBudgets();
    }
    return Object.freeze({
      withinBudget: this.lastEnforcement.withinBudget,
      evicted: [...this.lastEnforcement.evicted],
      failed: [...this.lastEnforcement.failed],
    });
  }

  setGlobalBudget(bytes) {
    this.#assertAlive();
    this.lastEnforcement = this.budgetManager.setGlobalBudget(bytes);
    return this.getDiagnostics();
  }

  setBodyBudget(bodyId, bytes) {
    this.#assertAlive();
    this.lastEnforcement = this.budgetManager.setBodyBudget(bodyId, bytes);
    return this.getDiagnostics();
  }

  getDiagnostics() {
    this.#assertAlive();
    const budget = this.budgetManager.getStats();
    const byBody = Object.fromEntries(Object.entries(budget.byBody).map(([id, value]) => [id, {
      ...value,
      usageRatio: value.budgetBytes > 0 ? value.bytes / value.budgetBytes : (value.bytes > 0 ? null : 0),
    }]));
    return Object.freeze({
      bridgeCount: this.bridges.size,
      globalBudgetBytes: budget.globalBudgetBytes,
      usedBytes: budget.usedBytes,
      remainingBytes: budget.remainingBytes,
      pinnedBytes: budget.pinnedBytes,
      resourceCount: budget.resourceCount,
      withinBudget: this.lastEnforcement.withinBudget,
      lastEvicted: [...this.lastEnforcement.evicted],
      lastFailedEvictions: [...this.lastEnforcement.failed],
      byBody: Object.freeze(byBody),
    });
  }

  dispose() {
    if (this.disposed) return;
    for (const bridge of [...this.bridges]) {
      try { bridge.dispose(); } catch (error) { this.onError?.(error, 'dispose-bridge'); }
    }
    this.bridges.clear();
    this.budgetManager.dispose();
    this.lastDecisions = [];
    this.disposed = true;
  }

  #assertAlive() {
    if (this.disposed) throw new Error('SatelliteGpuBudgetOrchestrator est déjà libéré.');
  }
}
