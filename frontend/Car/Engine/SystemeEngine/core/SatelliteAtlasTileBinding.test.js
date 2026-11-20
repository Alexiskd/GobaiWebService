import test from 'node:test';
import assert from 'node:assert/strict';
import { bindSatelliteAtlasEntryToTileUniforms, composeSatelliteAtlasUvRect } from './SatelliteAtlasTileBinding.js';

const vec4 = () => ({ value: { x: 0, y: 0, z: 1, w: 1, set(x, y, z, w) { Object.assign(this, { x, y, z, w }); } } });
const uniforms = () => ({
  map: { value: null }, baseRect: vec4(), hMap: { value: null }, hRect: vec4(), hHas: { value: 0 },
  ltMap: { value: null }, ltRect: vec4(), ltHas: { value: 0 },
});

test('compose le rectangle local avec les UV atlas', () => {
  const actual = Array.from(composeSatelliteAtlasUvRect([0.1, 0.2, 0.4, 0.5], [0.25, 0.5, 0.5, 0.25]));
  [0.2, 0.45, 0.2, 0.125].forEach((value, index) => assert.ok(Math.abs(actual[index] - value) < 1e-6));
});

test('branche couleur, altitude et nuit sur les uniforms historiques', () => {
  const u = uniforms();
  const textures = { color: { id: 'color' }, elevation: { id: 'height' }, night: { id: 'night' } };
  const result = bindSatelliteAtlasEntryToTileUniforms({ status: 'ready', uv: [0.1, 0.2, 0.4, 0.5], textures }, u);
  assert.deepEqual(result.applied, ['color', 'elevation', 'night']);
  assert.deepEqual(result.pending, []);
  assert.equal(u.map.value, textures.color);
  assert.equal(u.hMap.value, textures.elevation);
  assert.equal(u.ltMap.value, textures.night);
  assert.equal(u.hHas.value, 1);
  assert.equal(u.ltHas.value, 1);
  [u.baseRect.value.x, u.baseRect.value.y, u.baseRect.value.z, u.baseRect.value.w].forEach((value, index) => assert.ok(Math.abs(value - [0.1, 0.2, 0.4, 0.5][index]) < 1e-6));
});

test('signale la normale comme en attente sans inventer un uniform', () => {
  const result = bindSatelliteAtlasEntryToTileUniforms({ status: 'ready', uv: [0, 0, 1, 1], textures: { normal: {} } }, uniforms());
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.pending, ['normal']);
});

test('rejette les entrées non prêtes et les rectangles invalides', () => {
  assert.throws(() => bindSatelliteAtlasEntryToTileUniforms({ status: 'queued' }, uniforms()), /entrée atlas prête/);
  assert.throws(() => composeSatelliteAtlasUvRect([0, 0, 1, 1], [0.8, 0, 0.4, 1]), /rester dans/);
});
