import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteSurfaceAtlasDiagnostics, validateSatelliteAtlasTileBinding } from './SatelliteSurfaceAtlasDiagnostics.js';

function bound() {
  const texture = { id: 'atlas-color' };
  const entry = { status: 'ready', uv: new Float32Array([0.1, 0.2, 0.3, 0.4]), textures: { color: texture } };
  const uniforms = {
    map: { value: texture },
    baseRect: { value: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 } },
  };
  return { entry, uniforms };
}

test('valide un binding couleur dont la texture et les UV concordent', () => {
  const { entry, uniforms } = bound();
  const result = validateSatelliteAtlasTileBinding(entry, uniforms);
  assert.equal(result.ok, true);
  assert.deepEqual(result.checks, { ready: true, texture: true, rect: true, bounds: true });
});

test('détecte une texture non raccordée', () => {
  const { entry, uniforms } = bound();
  uniforms.map.value = { id: 'classic-texture' };
  assert.equal(validateSatelliteAtlasTileBinding(entry, uniforms).checks.texture, false);
});

test('détecte un rectangle UV différent', () => {
  const { entry, uniforms } = bound();
  uniforms.baseRect.value.x = 0.25;
  assert.equal(validateSatelliteAtlasTileBinding(entry, uniforms).checks.rect, false);
});

test('rejette les UV hors de la page', () => {
  const { entry, uniforms } = bound();
  entry.uv = [0.8, 0.2, 0.3, 0.4];
  uniforms.baseRect.value = { x: 0.8, y: 0.2, z: 0.3, w: 0.4 };
  assert.equal(validateSatelliteAtlasTileBinding(entry, uniforms).checks.bounds, false);
});

test('retourne un résultat invalide pour une entrée non prête', () => {
  assert.equal(validateSatelliteAtlasTileBinding({ status: 'queued' }, {}).ok, false);
});

test('compte les attaches et replis par astre', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  diagnostics.recordTileAttach({ id: 'earth:1', bodyId: 'earth', status: 'attached', validation: { ok: true } });
  diagnostics.recordTileAttach({ id: 'moon:1', bodyId: 'moon', status: 'fallback', reason: 'atlas-capacity' });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.counts.attached, 1);
  assert.equal(snapshot.counts.fallback, 1);
  assert.equal(snapshot.byBody.earth.validationPassed, 1);
  assert.equal(snapshot.byBody.moon.fallbackReasons['atlas-capacity'], 1);
});

test('borne le journal des tuiles sans perdre les compteurs cumulés', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics({ maxTiles: 2 });
  for (let index = 0; index < 5; index += 1) diagnostics.recordTileAttach({ id: `tile:${index}`, status: 'fallback' });
  assert.equal(diagnostics.snapshot().trackedTiles, 2);
  assert.equal(diagnostics.snapshot().counts.fallback, 5);
});

test('enregistre les mesures PerfProbe sans les attribuer à un astre', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  diagnostics.recordFrame({ timestamp: 123, perf: { cpuMs: 8, gpuMs: 4, calls: 100, triangles: 2000, textures: 30, geometries: 12 } });
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.latestFrame.cpuMs, 8);
  assert.match(snapshot.measurementScope, /globales de scène/);
  assert.equal(snapshot.visualPixelValidation, false);
});

test('compare deux séries explicitement étiquetées et calcule le delta', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  diagnostics.recordFrame({ mode: 'classic-reference', perf: { cpuMs: 10, calls: 120 } });
  diagnostics.recordFrame({ mode: 'classic-reference', perf: { cpuMs: 12, calls: 100 } });
  diagnostics.recordFrame({ mode: 'atlas-active', perf: { cpuMs: 8, calls: 80 } });
  const result = diagnostics.compareModes('classic-reference', 'atlas-active');
  assert.equal(result.comparable, true);
  assert.equal(result.deltaBMinusA.cpuMs, -3);
  assert.equal(result.deltaBMinusA.calls, -30);
});

test('ne prétend pas comparer des modes sans échantillons', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  const result = diagnostics.compareModes('classic-reference', 'atlas-active');
  assert.equal(result.comparable, false);
  assert.equal(result.deltaBMinusA.cpuMs, null);
});

test('borne les échantillons et les percentiles de comparaison', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics({ maxFrames: 3 });
  for (let value = 1; value <= 5; value += 1) diagnostics.recordFrame({ mode: 'classic', perf: { cpuMs: value } });
  const result = diagnostics.compareModes('classic', 'absent');
  assert.equal(result.a.sampleCount, 3);
  assert.equal(result.a.cpuMs.p50, 4);
  assert.equal(result.a.cpuMs.p95, 5);
});

test('libère ses journaux et refuse les opérations après dispose', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  diagnostics.recordFrame({ perf: { cpuMs: 1 } });
  diagnostics.dispose();
  assert.throws(() => diagnostics.snapshot(), /déjà libéré/);
});


test('efface la fenêtre A/B sans perdre les compteurs de tuiles', () => {
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  diagnostics.recordTileAttach({ id: 'earth:1', status: 'attached' });
  diagnostics.recordFrame({ mode: 'classic-reference', perf: { cpuMs: 10 } });
  assert.equal(diagnostics.clearFrameSamples(), 1);
  const snapshot = diagnostics.snapshot();
  assert.equal(snapshot.frameSamples, 0);
  assert.equal(snapshot.counts.attached, 1);
});
