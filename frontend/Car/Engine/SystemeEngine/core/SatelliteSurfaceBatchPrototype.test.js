import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SATELLITE_BATCH_VERTEX_SHADER,
  SATELLITE_BATCH_FRAGMENT_SHADER,
  normalizeSatelliteAtlasRect,
  writeSatelliteAtlasRect,
} from './SatelliteSurfaceBatchPrototype.js';

test('valide les rectangles UV et les maintient dans l’atlas', () => {
  const rect = normalizeSatelliteAtlasRect([0.25, 0.5, 0.25, 0.25]);
  assert.deepEqual(Array.from(rect), [0.25, 0.5, 0.25, 0.25]);
  assert.throws(() => normalizeSatelliteAtlasRect([0.9, 0, 0.2, 1]), RangeError);
  assert.throws(() => normalizeSatelliteAtlasRect([0, 0, 0, 1]), RangeError);
  assert.throws(() => normalizeSatelliteAtlasRect([0, 0, NaN, 1]), TypeError);
});

test('écrit les rectangles UV par instance sans chevauchement', () => {
  const buffer = new Float32Array(8);
  writeSatelliteAtlasRect(buffer, 0, [0, 0, 0.5, 1]);
  writeSatelliteAtlasRect(buffer, 1, [0.5, 0, 0.5, 1]);
  assert.deepEqual(Array.from(buffer), [0, 0, 0.5, 1, 0.5, 0, 0.5, 1]);
  assert.throws(() => writeSatelliteAtlasRect(buffer, 2, [0, 0, 1, 1]), RangeError);
});

test('le shader prototype utilise les attributs instanciés et la région atlas', () => {
  for (const attribute of ['surface0', 'surface1', 'surface2', 'surface3', 'atlasRect']) {
    assert.ok(SATELLITE_BATCH_VERTEX_SHADER.includes(`attribute vec4 ${attribute};`));
  }
  assert.ok(SATELLITE_BATCH_VERTEX_SHADER.includes('modelViewMatrix * instanceMatrix'));
  assert.ok(SATELLITE_BATCH_FRAGMENT_SHADER.includes('texture2D(uSurfaceAtlas, vAtlasUv)'));
  assert.ok(SATELLITE_BATCH_FRAGMENT_SHADER.includes('if (vVisible < 0.5) discard;'));
});
