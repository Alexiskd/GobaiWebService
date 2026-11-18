import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SATELLITE_SURFACE_STRIDE,
  packSatelliteSurfaceState,
  writeSatelliteSurfaceState,
  createSatelliteSurfaceAttributeViews,
  createSatelliteSurfaceAttributeBuffers,
} from './SatelliteSurfaceInstanceData.js';

test('packe les paramètres de surface dans un format fixe de 16 floats', () => {
  const packed = packSatelliteSurfaceState({
    radius: 1560.8, polarScale: 0.98, backdropK: 1.002, visible: false,
    uniforms: {
      shade: { value: 1 }, airless: { value: 1 }, ovMode: { value: 2 },
      colorOn: { value: 1 }, panOn: { value: 0 }, reliefExag: { value: 1.5 },
      reliefShade: { value: 0.8 }, reliefImg: { value: 0 }, oceanOn: { value: 0 },
      lightsOn: { value: 1 }, detail: { value: { x: 3 } },
    },
  });
  assert.equal(packed.length, SATELLITE_SURFACE_STRIDE);
  assert.equal(packed[0], Math.fround(1560.8));
  assert.equal(packed[4], 2);
  assert.equal(packed[13], 3);
  assert.equal(packed[15], 0);
});

test('écrit plusieurs états sans chevauchement et expose quatre vues vec4', () => {
  const buffer = createSatelliteSurfaceAttributeBuffers(2);
  const first = packSatelliteSurfaceState({ radius: 10 });
  const second = packSatelliteSurfaceState({ radius: 20 });
  assert.equal(writeSatelliteSurfaceState(buffer, 0, first), 0);
  assert.equal(writeSatelliteSurfaceState(buffer, 1, second), 1);
  const views = createSatelliteSurfaceAttributeViews(buffer, 2);
  assert.equal(views.surface0.length, 8);
  assert.equal(views.surface1.length, 8);
  assert.equal(views.surface2.length, 8);
  assert.equal(views.surface3.length, 8);
  assert.equal(views.surface0[0], 10);
  assert.equal(views.surface0[4], 20);
});

test('rejette les tailles, rayons et indices invalides', () => {
  assert.throws(() => packSatelliteSurfaceState({ radius: 0 }), RangeError);
  assert.throws(() => writeSatelliteSurfaceState(createSatelliteSurfaceAttributeBuffers(1), -1, new Float32Array(16)), RangeError);
  assert.throws(() => createSatelliteSurfaceAttributeViews({ surface0: new Float32Array(3) }, 1), RangeError);
});
