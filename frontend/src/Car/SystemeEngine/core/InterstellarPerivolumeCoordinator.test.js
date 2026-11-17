import test from 'node:test';
import assert from 'node:assert/strict';
import { InterstellarPerivolumeCoordinator } from './InterstellarPerivolumeCoordinator.js';
import { LOAD_STATE } from './PerivolumeManager.js';

function setup() {
  const coordinator = new InterstellarPerivolumeCoordinator({ hysteresis: 0 });
  const solar = { visible: true, userData: {} }; const distant = { visible: true, userData: {} };
  coordinator.register({ id: 'system:solar', center: [0, 0, 0], radius: 10, backgroundRadius: 30, group: solar });
  coordinator.register({ id: 'system:exemple', center: [100, 0, 0], radius: 10, backgroundRadius: 30, group: distant });
  return { coordinator, solar, distant };
}

test('axiome externe : entrer dans le périvolume solaire décharge le système distant', () => {
  const { coordinator, solar, distant } = setup();
  const decisions = coordinator.update([0, 0, 0]);
  assert.equal(decisions.find((x) => x.id === 'system:solar').state, LOAD_STATE.ACTIVE);
  assert.equal(decisions.find((x) => x.id === 'system:exemple').state, LOAD_STATE.UNLOADED);
  assert.equal(distant.visible, false); assert.equal(solar.visible, true);
});
test('axiome externe : entrer dans le périvolume distant décharge le Soleil', () => {
  const { coordinator, solar, distant } = setup();
  const decisions = coordinator.update([100, 0, 0]);
  assert.equal(decisions.find((x) => x.id === 'system:exemple').state, LOAD_STATE.ACTIVE);
  assert.equal(decisions.find((x) => x.id === 'system:solar').state, LOAD_STATE.UNLOADED);
  assert.equal(solar.visible, false); assert.equal(distant.visible, true);
});
test('BACKGROUND reste visible mais sa simulation est suspendue', () => {
  const { coordinator, distant } = setup();
  coordinator.update([75, 0, 0]);
  assert.equal(distant.visible, true);
  assert.equal(distant.userData.simulationPaused, true);
  assert.equal(coordinator.getProfile('system:exemple').update, false);
});
test('rejette les centres invalides et permet le retrait', () => {
  const { coordinator } = setup();
  assert.throws(() => coordinator.register({ id: 'bad', center: [0, NaN, 0], radius: 1 }), /center/);
  assert.equal(coordinator.unregister('system:exemple'), true);
});
