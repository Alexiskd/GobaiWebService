import test from 'node:test';
import assert from 'node:assert/strict';
import { SatelliteTileAtlasPipeline } from './SatelliteTileAtlasPipeline.js';

function fakeAtlas() {
  const entries = new Map();
  return {
    enqueue({ id, width, height, layers, bodyId }) { this.bodyId = bodyId; this.pending = { id, width, height, layers }; },
    processQueue(count) { if (count && this.pending) { const p = this.pending; entries.set(p.id, { status: 'ready', uv: [0.1, 0.2, 0.5, 0.5], textures: { color: { id: 'atlas-color' } } }); this.pending = null; } },
    cancelQueued(id) { if (this.pending?.id === id) { this.pending = null; return true; } return false; },
    get(id) { return entries.get(id) || null; },
    retain(id) { return entries.has(id); },
    release(id) { return entries.delete(id); },
  };
}
const v4 = () => ({ value: { set(x,y,z,w) { Object.assign(this,{x,y,z,w}); } } });
const makeUniforms = () => ({ map: { value: 'fallback' }, baseRect: v4() });

test('attache une texture atlas couleur sans perdre le chemin de repli', () => {
  const atlas = fakeAtlas(); const pipeline = new SatelliteTileAtlasPipeline({ atlas }); const uniforms = makeUniforms();
  const result = pipeline.attach({ id: '0/0/0', image: { width: 256, height: 256 }, uniforms });
  assert.equal(result.status, 'attached');
  assert.equal(uniforms.map.value.id, 'atlas-color');
  [uniforms.baseRect.value.x, uniforms.baseRect.value.y, uniforms.baseRect.value.z, uniforms.baseRect.value.w].forEach((value, index) => assert.ok(Math.abs(value - [0.1,0.2,0.5,0.5][index]) < 1e-6));
});

test('laisse la tuile sur son image classique si la file ne termine pas', () => {
  const atlas = fakeAtlas(); atlas.processQueue = () => {};
  const uniforms = makeUniforms(); const pipeline = new SatelliteTileAtlasPipeline({ atlas });
  const result = pipeline.attach({ id: 'pending', image: { width: 16, height: 16 }, uniforms });
  assert.equal(result.status, 'fallback');
  assert.equal(result.reason, 'atlas-capacity');
  assert.equal(atlas.pending, null);
  assert.equal(uniforms.map.value, 'fallback');
});

test('retourne le repli si les dimensions de l’image sont absentes', () => {
  const pipeline = new SatelliteTileAtlasPipeline({ atlas: fakeAtlas() });
  assert.equal(pipeline.attach({ id: 'bad', image: {}, uniforms: makeUniforms() }).status, 'fallback');
});

test('libère les entrées logiques attachées sans détruire le gestionnaire', () => {
  const atlas = fakeAtlas(); const pipeline = new SatelliteTileAtlasPipeline({ atlas });
  pipeline.attach({ id: 'release-me', image: { width: 4, height: 4 }, uniforms: makeUniforms() });
  assert.equal(pipeline.release('release-me'), true);
  assert.equal(atlas.get('release-me'), null);
});

test('branche le pipeline au budget GPU avec propriétaire d’astre', async () => {
  const { SatelliteMultiLayerTextureAtlasManager, SATELLITE_ATLAS_CHANNELS } = await import('./SatelliteMultiLayerTextureAtlas.js');
  const { SatelliteGpuMemoryBudgetManager } = await import('./SatelliteGpuMemoryBudgetManager.js');
  const { SatelliteAtlasGpuBudgetBridge } = await import('./SatelliteAtlasGpuBudgetBridge.js');
  const channels = Object.fromEntries(SATELLITE_ATLAS_CHANNELS.map((name) => [name, {
    createPage: () => ({ texture: { id: name, dispose() {} } }),
    blit() {},
  }]));
  const atlas = new SatelliteMultiLayerTextureAtlasManager({ pageSize: 32, channels });
  const budget = new SatelliteGpuMemoryBudgetManager({ globalBudgetBytes: 1_000_000, defaultBodyBudgetBytes: 1_000_000 });
  const bridge = new SatelliteAtlasGpuBudgetBridge({ atlas, budgetManager: budget });
  const pipeline = new SatelliteTileAtlasPipeline({ atlas, memoryBudgetBridge: bridge });
  const result = pipeline.attach({ id: 'earth/0/0', bodyId: 'earth', image: { width: 8, height: 8 }, uniforms: makeUniforms() });
  assert.equal(result.status, 'attached');
  assert.equal(budget.getStats().resourceCount, 1);
  assert.equal(budget.getStats().byBody.earth.resourceCount, 1);
  assert.equal(budget.getStats().pinnedBytes, 32 * 32 * 4 * 4);
  pipeline.release('earth/0/0');
  assert.equal(budget.getStats().pinnedBytes, 0);
  pipeline.dispose(); bridge.dispose(); atlas.dispose(); budget.dispose();
});

test('transmet le bodyId configuré à enqueue pour attribuer la page au bon astre', () => {
  const atlas = fakeAtlas();
  const pipeline = new SatelliteTileAtlasPipeline({ atlas, bodyId: 'earth' });
  const result = pipeline.attach({ id: 'tile:0/0/0', image: { width: 16, height: 16 }, uniforms: makeUniforms() });
  assert.equal(result.status, 'attached');
  assert.equal(atlas.bodyId, 'earth');
});

test('publie les validations structurelles dans les diagnostics atlas', async () => {
  const { SatelliteSurfaceAtlasDiagnostics } = await import('./SatelliteSurfaceAtlasDiagnostics.js');
  const atlas = fakeAtlas();
  const diagnostics = new SatelliteSurfaceAtlasDiagnostics();
  const pipeline = new SatelliteTileAtlasPipeline({ atlas, bodyId: 'earth', diagnostics });
  const uniforms = makeUniforms();
  const result = pipeline.attach({ id: 'tile:diagnostic', image: { width: 16, height: 16 }, uniforms });
  assert.equal(result.status, 'attached');
  assert.equal(result.validation.ok, true);
  assert.equal(diagnostics.snapshot().counts.validationPassed, 1);
  pipeline.release('tile:diagnostic');
  assert.equal(diagnostics.snapshot().counts.released, 1);
});


test('bascule à chaud vers le rendu classique puis revient à l’atlas', () => {
  const atlas = fakeAtlas();
  const pipeline = new SatelliteTileAtlasPipeline({ atlas });
  const classicTexture = { id: 'classic-texture' };
  const uniforms = makeUniforms();
  uniforms.map.value = classicTexture;
  uniforms.baseRect.value.set(0.05, 0.1, 0.8, 0.7);
  const attached = pipeline.attach({ id: 'toggle:1', image: { width: 64, height: 64 }, uniforms });
  assert.equal(attached.status, 'attached');
  assert.equal(uniforms.map.value.id, 'atlas-color');

  const toClassic = pipeline.setMode('classic');
  assert.equal(toClassic.changed, 1);
  assert.equal(uniforms.map.value, classicTexture);
  assert.deepEqual([uniforms.baseRect.value.x, uniforms.baseRect.value.y, uniforms.baseRect.value.z, uniforms.baseRect.value.w], [0.05, 0.1, 0.8, 0.7]);

  const toAtlas = pipeline.setMode('atlas');
  assert.equal(toAtlas.changed, 1);
  assert.equal(uniforms.map.value.id, 'atlas-color');
  assert.equal(pipeline.getMode(), 'atlas');
});

test('une tuile ajoutée en mode classique peut ensuite être activée dans l’atlas', () => {
  const atlas = fakeAtlas();
  const pipeline = new SatelliteTileAtlasPipeline({ atlas, mode: 'classic' });
  const uniforms = makeUniforms();
  const classicTexture = uniforms.map.value;
  const attached = pipeline.attach({ id: 'classic-first', image: { width: 32, height: 32 }, uniforms });
  assert.equal(attached.status, 'attached');
  assert.equal(uniforms.map.value, classicTexture);
  assert.equal(pipeline.setMode('atlas').changed, 1);
  assert.equal(uniforms.map.value.id, 'atlas-color');
});

test('libérer une tuile restaure ses uniforms classiques avant de libérer l’atlas', () => {
  const atlas = fakeAtlas();
  const pipeline = new SatelliteTileAtlasPipeline({ atlas });
  const uniforms = makeUniforms();
  const classicTexture = uniforms.map.value;
  pipeline.attach({ id: 'release-restore', image: { width: 8, height: 8 }, uniforms });
  assert.equal(uniforms.map.value.id, 'atlas-color');
  pipeline.release('release-restore');
  assert.equal(uniforms.map.value, classicTexture);
  assert.equal(pipeline.bindings.size, 0);
});

test('refuse un mode A/B inconnu', () => {
  const pipeline = new SatelliteTileAtlasPipeline({ atlas: fakeAtlas() });
  assert.throws(() => pipeline.setMode('automatic'), /mode doit être atlas ou classic/);
});
