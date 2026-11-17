import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteAtlasBrowserValidationAdapter } from './SatelliteAtlasBrowserValidation.js';

function vector(initial) { return { value: [...initial], set(x, y, z) { this.value = [x, y, z]; }, clone() { return vector(this.value); }, copy(other) { this.value = [...other.value]; } }; }

function createBrowserHarness() {
  const pixels = new Uint8ClampedArray([12, 24, 36, 255, 48, 60, 72, 255]);
  const source = { width: 2, height: 1 };
  const documentRef = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: () => {},
        getImageData: () => ({ data: pixels }),
      }),
      toDataURL: () => 'data:image/png;base64,dGVzdA==',
    }),
  };
  const requestFrame = (callback) => callback(0);
  const engine = {
    renderer: { domElement: source },
    surfaceAtlasRuntimes: new Map([['earth', { pipeline: { mode: 'atlas', getMode() { return this.mode; }, setMode(mode) { this.mode = mode; return mode; } } }]]),
    speed: 1, simMs: 1234, autoRotate: true, az: 1, el: 0.5, dist: 10, distGoal: 10,
    target: vector([1, 2, 3]), targetStart: vector([1, 2, 3]),
    focusTargets: [{ tiled: { id: 'earth' }, get: () => vector([4, 5, 6]) }],
    focusTarget() { return this.focusTargets[this.focus]; },
    focus: 0, focusT: 0.4,
    setSurfaceAtlasMode(mode, bodyId) {
      const runtime = this.surfaceAtlasRuntimes.get(bodyId);
      if (!runtime) return { ok: false, reason: 'unknown-body' };
      runtime.pipeline.setMode(mode);
      return { ok: true, mode, bodies: { [bodyId]: mode } };
    },
  };
  return { engine, documentRef, requestFrame };
}

test('crée des captures RGBA depuis le canvas et conserve les PNG pour le rapport', async () => {
  const harness = createBrowserHarness();
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, harness);
  const frame = await adapter.captureFrame({ bodyId: 'earth', viewKey: 'fixed', mode: 'classic' });
  assert.equal(frame.width, 2);
  assert.equal(frame.height, 1);
  assert.equal(frame.data.length, 8);
  assert.match(adapter.captures.get('earth:fixed:classic').dataUrl, /^data:image\/png/);
});

test('gèle le temps orbital et restaure la vue après le scénario', async () => {
  const harness = createBrowserHarness();
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, harness);
  const restore = await adapter.setView({ bodyId: 'earth', viewKey: 'fixed', cameraState: { az: 2, el: 0.8, dist: 5 } });
  assert.equal(harness.engine.speed, 0);
  assert.equal(harness.engine.autoRotate, false);
  assert.equal(harness.engine.az, 2);
  assert.deepEqual(harness.engine.target.value, [4, 5, 6]);
  await restore();
  assert.equal(harness.engine.speed, 1);
  assert.equal(harness.engine.autoRotate, true);
  assert.equal(harness.engine.az, 1);
  assert.deepEqual(harness.engine.target.value, [1, 2, 3]);
});

test('exécute le scénario réel injecté et restaure le mode initial', async () => {
  const harness = createBrowserHarness();
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, harness, { frameCount: 1 });
  const run = adapter.createRunner({ scenarios: [{ bodyId: 'earth', viewKey: 'earth-fixed' }] });
  const report = await run.run();
  assert.equal(report.scenarioCount, 1);
  assert.equal(harness.engine.surfaceAtlasRuntimes.get('earth').pipeline.getMode(), 'atlas');
  assert.ok(adapter.captures.has('earth:earth-fixed:classic'));
  assert.ok(adapter.captures.has('earth:earth-fixed:atlas'));
});

test('génère un rapport HTML autonome avec les deux captures', async () => {
  const harness = createBrowserHarness();
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, harness);
  const runner = adapter.createRunner({ scenarios: [{ bodyId: 'earth', viewKey: 'fixed' }] });
  const report = await runner.run();
  const html = adapter.buildHtmlReport(report);
  assert.match(html, /Gobai Space — Validation visuelle Atlas/);
  assert.equal((html.match(/data:image\/png/g) || []).length, 2);
  assert.match(html, /Rapport JSON complet/);
});

test('refuse un moteur sans canvas ou un contexte de navigateur absent', () => {
  assert.throws(() => new SatelliteAtlasBrowserValidationAdapter({}), /SolarEngine initialisé/);
  const harness = createBrowserHarness();
  assert.throws(() => new SatelliteAtlasBrowserValidationAdapter(harness.engine, { documentRef: null, requestFrame: null }), /document et requestAnimationFrame/);
});

test('signale explicitement une lecture canvas impossible', async () => {
  const harness = createBrowserHarness();
  harness.documentRef.createElement = () => ({ width: 0, height: 0, getContext: () => ({ drawImage() { throw new Error('tainted'); } }) });
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, harness);
  await assert.rejects(adapter.captureFrame({ bodyId: 'earth', viewKey: 'fixed', mode: 'atlas' }), /canvas potentiellement non lisible\/CORS/);
});

test('restaure le moteur si l’attente de stabilité échoue avant les captures', async () => {
  const harness = createBrowserHarness();
  const adapter = new SatelliteAtlasBrowserValidationAdapter(harness.engine, {
    ...harness,
    waitUntilReady: async () => { throw new Error('tiles timeout'); },
  });
  await assert.rejects(adapter.setView({ bodyId: 'earth', viewKey: 'fixed' }), /tiles timeout/);
  assert.equal(harness.engine.speed, 1);
  assert.equal(harness.engine.autoRotate, true);
});
