import test from 'node:test';
import assert from 'node:assert/strict';
import { LODManager } from './LODManager.js';
import { RenderScheduler } from './RenderScheduler.js';
import { LOD } from '../../AstreSolideEngine/bodyLoading.jsx';

test('LODManager réutilise les niveaux existants et planifie les tuiles avec un budget', () => {
  const manager = new LODManager({ maxTiledBodies: 1 });
  const result = manager.evaluateBodies([
    { id: 'earth', px: 100, inView: true, focused: true },
    { id: 'mars', px: 20, inView: true },
    { id: 'jupiter', px: 0.1, inView: true },
    { id: 'venus', px: 20, inView: false },
  ], { tick: 0 });
  assert.equal(result.byId.get('earth'), LOD.TILES);
  assert.equal(result.byId.get('jupiter'), LOD.POINT);
  assert.equal(result.byId.get('venus'), LOD.CULLED);
  assert.deepEqual([...result.tiled], ['earth']);
});

test('LODManager applique l hystérésis des satellites', () => {
  const manager = new LODManager();
  assert.equal(manager.evaluateSatellite({ id: 'moon', orbitPx: 15 }), true);
  assert.equal(manager.evaluateSatellite({ id: 'moon', orbitPx: 12 }), true);
  assert.equal(manager.evaluateSatellite({ id: 'moon', orbitPx: 9 }), false);
  assert.equal(manager.forgetSatellite('moon'), true);
});

test('RenderScheduler respecte le budget et la priorité', () => {
  const scheduler = new RenderScheduler({ maxTasksPerFrame: 2 });
  const calls = [];
  scheduler.schedule({ id: 'low', priority: 1, run: () => calls.push('low') });
  scheduler.schedule({ id: 'high', priority: 10, run: () => calls.push('high') });
  scheduler.schedule({ id: 'mid', priority: 5, run: () => calls.push('mid') });
  const frame = scheduler.flush();
  assert.deepEqual(calls, ['high', 'mid']);
  assert.equal(frame.executed, 2);
  assert.equal(frame.remaining, 1);
  scheduler.flush();
  assert.deepEqual(calls, ['high', 'mid', 'low']);
});

test('RenderScheduler remplace une tâche par identifiant et autorise son reprogrammation', () => {
  const scheduler = new RenderScheduler({ maxTasksPerFrame: 1 });
  let count = 0;
  scheduler.schedule({ id: 'refresh', run: () => { count += 1; } });
  scheduler.schedule({ id: 'refresh', priority: 2, run: () => { count += 10; scheduler.schedule({ id: 'refresh', run: () => { count += 100; } }); } });
  scheduler.flush();
  scheduler.flush();
  assert.equal(count, 110);
  assert.equal(scheduler.size, 0);
});

test('RenderScheduler signale les erreurs sans bloquer les tâches suivantes', () => {
  const errors = [];
  const scheduler = new RenderScheduler({ maxTasksPerFrame: 2, onError: (error, id) => errors.push([error.message, id]) });
  scheduler.schedule({ id: 'broken', run: () => { throw new Error('boom'); } });
  scheduler.schedule({ id: 'ok', run: () => {} });
  const result = scheduler.flush();
  assert.equal(result.results[0].status, 'failed');
  assert.equal(result.results[1].status, 'completed');
  assert.deepEqual(errors, [['boom', 'broken']]);
});
