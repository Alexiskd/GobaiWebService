import test from 'node:test';
import assert from 'node:assert/strict';
import { GalacticSectorScheduler } from './GalacticSectorScheduler.js';

const flush = async () => { await new Promise((resolve) => setImmediate(resolve)); await new Promise((resolve) => setImmediate(resolve)); };

test('le planificateur est désactivé par défaut et ne lance aucune requête', () => {
  let calls = 0;
  const scheduler = new GalacticSectorScheduler({ streamer: { loadConePages: async () => { calls += 1; return { stars: [] }; } }, onSectorLoaded() {} });
  scheduler.updateView({ raDeg: 12, decDeg: 4, radiusDeg: 1 });
  assert.equal(calls, 0);
  assert.equal(scheduler.getStats().queued, 0);
  scheduler.dispose();
});

test('programme un nombre borné de tuiles autour de la caméra', async () => {
  const requests = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages(cone) { requests.push(cone); return { stars: [], count: 0 }; } },
    onSectorLoaded() {}, maxConcurrent: 1, maxPrefetchSectors: 3, maxQueued: 4,
  });
  scheduler.setEnabled(true);
  const stats = scheduler.updateView({ raDeg: 120, decDeg: 15, radiusDeg: 1 });
  assert.equal(stats.active, 1);
  assert.equal(stats.queued, 2);
  await flush();
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.radiusDeg <= 5));
  scheduler.dispose();
});

test('les secteurs chargés ne sont pas redemandés et les coordonnées RA bouclent', async () => {
  const requests = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages(cone) { requests.push(cone); return { stars: [], count: 0 }; } },
    onSectorLoaded() {}, maxPrefetchSectors: 1,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 359.9, decDeg: 0, radiusDeg: 1 });
  await flush();
  const count = requests.length;
  scheduler.updateView({ raDeg: 359.9, decDeg: 0, radiusDeg: 1 });
  await flush();
  assert.equal(requests.length, count);
  assert.ok(requests[0].raDeg >= 0 && requests[0].raDeg < 360);
  scheduler.dispose();
});

test('désactiver le streaming annule les tâches en cours', async () => {
  let receivedSignal;
  const scheduler = new GalacticSectorScheduler({
    streamer: { loadConePages: (_cone, { signal }) => { receivedSignal = signal; return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); } },
    onSectorLoaded() {}, maxPrefetchSectors: 1,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 40, decDeg: 10, radiusDeg: 1 });
  await flush();
  scheduler.setEnabled(false);
  assert.equal(receivedSignal.aborted, true);
  scheduler.dispose();
});

test('les requêtes échouées sont soumises à un délai de retry', async () => {
  let calls = 0;
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages() { calls += 1; throw new Error('offline'); } },
    onSectorLoaded() {}, maxPrefetchSectors: 1, retryDelayMs: 60000,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 50, decDeg: 20, radiusDeg: 1 });
  await flush();
  scheduler.updateView({ raDeg: 50, decDeg: 20, radiusDeg: 1 });
  assert.equal(calls, 1);
  assert.equal(scheduler.getStats().skippedBackoff, 1);
  scheduler.dispose();
});

test('reprend la pagination keyset jusqu’au plafond par secteur', async () => {
  const cursors = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages(cone) {
      cursors.push(cone.sourceIdAfter ?? null);
      return cursors.length === 1
        ? { stars: [], pagesLoaded: 1, hasMore: true, nextSourceIdAfter: '100' }
        : { stars: [], pagesLoaded: 1, hasMore: false, nextSourceIdAfter: '200' };
    } },
    onSectorLoaded() {}, maxPrefetchSectors: 1, maxPages: 1, maxPagesPerSector: 2,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 80, decDeg: 5, radiusDeg: 1 });
  await flush();
  assert.deepEqual(cursors, [null, '100']);
  assert.equal(scheduler.getStats().loadedSectors, 1);
  scheduler.dispose();
});


test('évince les étoiles d’une tuile lorsque la caméra quitte son voisinage', async () => {
  const evicted = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages(cone) { return { stars: [{ id: `star:${cone.raDeg}` }], count: 1, pagesLoaded: 1, hasMore: false }; } },
    onSectorLoaded() {}, onSectorEvicted: (event) => evicted.push(event), maxPrefetchSectors: 1,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 10, decDeg: 0, radiusDeg: 0.5 });
  await flush();
  scheduler.updateView({ raDeg: 180, decDeg: 0, radiusDeg: 0.5 });
  assert.equal(evicted.length, 1);
  assert.equal(evicted[0].starIds.length, 1);
  scheduler.dispose();
});

test('expose les secteurs épinglés par la vue et permet une éviction mémoire explicite', async () => {
  const evicted = [];
  const views = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { async loadConePages(cone) { return { stars: [{ id: 'star:1' }], count: 1 }; } },
    onSectorLoaded() {}, onSectorEvicted: (entry) => evicted.push(entry),
    onViewChanged: (view) => views.push(view), maxPrefetchSectors: 1,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 25, decDeg: 5, radiusDeg: 1 });
  await flush();
  assert.equal(views.length, 1);
  assert.equal(views[0].sectorKeys.length, 1);
  const key = views[0].sectorKeys[0];
  assert.equal(scheduler.evictSector(key, 'test-budget'), true);
  assert.equal(evicted.length, 1);
  assert.deepEqual(evicted[0].starIds, ['star:1']);
  assert.equal(scheduler.getStats().loadedSectors, 0);
  scheduler.dispose();
});


test('prédit une tuile dans la direction du mouvement caméra', () => {
  let now = 1000;
  const views = [];
  const scheduler = new GalacticSectorScheduler({
    streamer: { loadConePages: async () => new Promise(() => {}) },
    onSectorLoaded() {}, onViewChanged: (view) => views.push(view),
    maxPrefetchSectors: 1, maxQueued: 2, predictionHorizonMs: 1000,
    maxPredictionDeg: 1.5, minMotionDegPerSec: 0.1, now: () => now,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 10, decDeg: 0, radiusDeg: 0.5 });
  now += 1000;
  scheduler.updateView({ raDeg: 11.2, decDeg: 0, radiusDeg: 0.5 });
  const view = views.at(-1);
  assert.equal(view.prediction.active, true);
  assert.ok(view.prediction.predictedRaDeg > 11.2);
  assert.ok(view.sectorKeys.length >= 2);
  assert.ok(view.sectors.some((sector) => sector.predictive === true));
  assert.ok(view.prediction.offsetDeg <= 1.5);
  scheduler.dispose();
});

test('désactive la prédiction lorsque la caméra est immobile', () => {
  let now = 0;
  const scheduler = new GalacticSectorScheduler({
    streamer: { loadConePages: async () => new Promise(() => {}) },
    onSectorLoaded() {}, maxPrefetchSectors: 1, now: () => now,
  });
  scheduler.setEnabled(true);
  scheduler.updateView({ raDeg: 40, decDeg: 10, radiusDeg: 1 });
  now = 1000;
  scheduler.updateView({ raDeg: 40, decDeg: 10, radiusDeg: 1 });
  assert.equal(scheduler.getStats().prediction.active, false);
  scheduler.dispose();
});
