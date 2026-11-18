import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteGpuMemoryBudgetManager } from './SatelliteGpuMemoryBudgetManager.js';
import { SatelliteGpuBudgetOrchestrator } from './SatelliteGpuBudgetOrchestrator.js';

function makeBridge(manager, { bytes = 100, bodyId = 'earth', pinned = false } = {}) {
  let disposed = false;
  let syncCount = 0;
  let evicted = 0;
  manager.register({ id: 'page-1', bodyId, bytes, pinned, evict: () => { evicted += 1; return true; } });
  return {
    budgetManager: manager,
    sync() { syncCount += 1; return { registered: [], updated: [], forgotten: [], rejected: [], withinBudget: true }; },
    syncPerivolumeDecisions(decisions) { manager.syncPerivolumeDecisions(decisions); this.sync(); },
    dispose() { disposed = true; manager.forget('page-1'); },
    get state() { return { disposed, syncCount, evicted }; },
  };
}

test('enregistre un bridge utilisant le gestionnaire central et le synchronise une fois', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1000 });
  const orchestrator = new SatelliteGpuBudgetOrchestrator({ budgetManager: manager });
  const bridge = makeBridge(manager);
  const unregister = orchestrator.registerBridge(bridge);
  assert.equal(bridge.state.syncCount, 1);
  assert.equal(orchestrator.getDiagnostics().bridgeCount, 1);
  assert.equal(unregister(), true);
  assert.equal(bridge.state.disposed, true);
  assert.equal(orchestrator.getDiagnostics().bridgeCount, 0);
  orchestrator.dispose();
});

test('synchronise les états de périvolume et évince une ressource inactive au dépassement', () => {
  const manager = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 200, defaultBodyBudgetBytes: 200 });
  const orchestrator = new SatelliteGpuBudgetOrchestrator({ budgetManager: manager });
  const bridge = makeBridge(manager, { bytes: 80, bodyId: 'moon' });
  orchestrator.registerBridge(bridge);
  manager.register({ id: 'earth-page', bodyId: 'earth', bytes: 80, evict: () => true });
  orchestrator.updatePerivolumeDecisions([
    { id: 'earth', state: 'ACTIVE' },
    { id: 'moon', state: 'UNLOADED' },
  ]);
  const diagnostics = orchestrator.setGlobalBudget(100);
  assert.equal(diagnostics.withinBudget, true);
  assert.equal(diagnostics.usedBytes, 80);
  assert.equal(diagnostics.lastEvicted.length, 1);
  assert.equal(diagnostics.lastEvicted[0], 'page-1');
  orchestrator.dispose();
});

test('expose les budgets par astre et permet de modifier le budget global', () => {
  const orchestrator = new SatelliteGpuBudgetOrchestrator({ globalBudgetBytes: 500, defaultBodyBudgetBytes: 400 });
  const manager = orchestrator.budgetManager;
  manager.register({ id: 'earth-page', bodyId: 'earth', bytes: 200, evict: () => true });
  orchestrator.updatePerivolumeDecisions([{ id: 'earth', state: 'ACTIVE' }]);
  const before = orchestrator.getDiagnostics();
  assert.equal(before.byBody.earth.bytes, 200);
  assert.equal(before.byBody.earth.usageRatio, 0.5);
  const after = orchestrator.setGlobalBudget(100);
  assert.equal(after.usedBytes, 0);
  assert.equal(after.withinBudget, true);
  orchestrator.dispose();
});

test('refuse un bridge attaché à un autre gestionnaire mémoire', () => {
  const orchestrator = new SatelliteGpuBudgetOrchestrator();
  const other = new SatelliteGpuMemoryBudgetManager();
  const bridge = makeBridge(other);
  assert.throws(() => orchestrator.registerBridge(bridge), /budget central/);
  orchestrator.dispose();
  other.dispose();
});
