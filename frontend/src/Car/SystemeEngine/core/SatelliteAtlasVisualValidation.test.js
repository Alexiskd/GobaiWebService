import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeSatelliteAtlasTileBoundaries,
  compareSatelliteAtlasVisualFrames,
  SatelliteAtlasVisualValidationRunner,
  serializeSatelliteAtlasVisualReport,
} from './SatelliteAtlasVisualValidation.js';

function frame(width, height, pixels) { return { width, height, data: new Uint8ClampedArray(pixels) }; }
function solid(width, height, rgba) { return frame(width, height, Array.from({ length: width * height }, () => rgba).flat()); }

test('retourne une comparaison parfaite pour deux captures identiques', () => {
  const result = compareSatelliteAtlasVisualFrames(solid(2, 2, [10, 20, 30, 255]), solid(2, 2, [10, 20, 30, 255]));
  assert.equal(result.passed, true);
  assert.equal(result.meanAbsoluteDifference, 0);
  assert.equal(result.changedPixelRatio, 0);
});

test('détecte une différence pixel dépassant les limites', () => {
  const classic = solid(2, 1, [0, 0, 0, 255]);
  const atlas = frame(2, 1, [255, 0, 0, 255, 0, 0, 0, 255]);
  const result = compareSatelliteAtlasVisualFrames(classic, atlas, { pixelThreshold: 2, limits: { maxMeanAbsoluteDifference: 1, maxChangedPixelRatio: 0.1 } });
  assert.equal(result.passed, false);
  assert.equal(result.changedPixels, 1);
});

test('refuse des captures de dimensions différentes ou des buffers incomplets', () => {
  assert.throws(() => compareSatelliteAtlasVisualFrames(solid(1, 1, [0, 0, 0, 255]), solid(2, 1, [0, 0, 0, 255])), /mêmes dimensions/);
  assert.throws(() => compareSatelliteAtlasVisualFrames({ width: 1, height: 1, data: [] }, solid(1, 1, [0, 0, 0, 255])), /données RGBA/);
});

test('mesure les discontinuités aux frontières verticales et horizontales', () => {
  const image = frame(2, 2, [0, 0, 0, 255, 100, 100, 100, 255, 0, 0, 0, 255, 100, 100, 100, 255]);
  const result = analyzeSatelliteAtlasTileBoundaries(image, { vertical: [1], horizontal: [1] });
  assert.equal(result.boundaryCount, 2);
  assert.equal(result.vertical[0].meanLuminanceStep, 100);
  assert.equal(result.horizontal[0].meanLuminanceStep, 0);
});

test('rejette les frontières hors de la capture', () => {
  assert.throws(() => analyzeSatelliteAtlasTileBoundaries(solid(2, 2, [0, 0, 0, 255]), { vertical: [2] }), /hors image/);
});

test('exécute les scénarios A/B et restaure le mode initial', async () => {
  let mode = 'classic';
  const calls = [];
  const runner = new SatelliteAtlasVisualValidationRunner({
    getMode: () => mode,
    setMode: async (next, bodyId) => { mode = next; calls.push([next, bodyId]); },
    setView: async (scenario) => { calls.push(['view', scenario.viewKey]); return () => calls.push(['restore-view']); },
    captureFrame: async ({ mode: selected }) => solid(2, 2, selected === 'classic' ? [20, 20, 20, 255] : [20, 20, 20, 255]),
    scenarios: [{ bodyId: 'earth', viewKey: 'earth-reference' }, { bodyId: 'moon', viewKey: 'moon-reference' }],
  });
  const report = await runner.run();
  assert.equal(report.passed, true);
  assert.equal(report.scenarioCount, 2);
  assert.equal(mode, 'classic');
  assert.ok(calls.some(([action]) => action === 'atlas'));
  assert.ok(calls.filter(([action]) => action === 'restore-view').length === 2);
});

test('restaure le mode initial même si la capture échoue', async () => {
  let mode = 'atlas';
  const runner = new SatelliteAtlasVisualValidationRunner({
    getMode: () => mode,
    setMode: (next) => { mode = next; },
    setView: () => undefined,
    captureFrame: () => { throw new Error('capture failed'); },
    scenarios: [{ bodyId: 'earth', viewKey: 'fixed' }],
  });
  await assert.rejects(runner.run(), /capture failed/);
  assert.equal(mode, 'atlas');
});

test('empêche deux exécutions concurrentes', async () => {
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  const runner = new SatelliteAtlasVisualValidationRunner({
    getMode: () => 'classic', setMode: () => {}, setView: () => {},
    captureFrame: async () => { await waiting; return solid(1, 1, [0, 0, 0, 255]); },
    scenarios: [{ bodyId: 'earth', viewKey: 'fixed' }],
  });
  const first = runner.run();
  await assert.rejects(runner.run(), /déjà en cours/);
  release();
  await first;
});

test('sérialise un rapport sans transformer les résultats en texte opaque', () => {
  const report = { results: [{ bodyId: 'earth', passed: true }] };
  assert.match(serializeSatelliteAtlasVisualReport(report), /"bodyId": "earth"/);
  assert.throws(() => serializeSatelliteAtlasVisualReport({}), /invalide/);
});
