// Tests des calculs de la caméra du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ALTITUDE_M, PITCH_MAX_DEG, PITCH_MIN_DEG, TILT_PITCH_DEG, clampPitch, moveAngles, pitchForTilt, wrapHeading, zoomStep } from './cesium-earth.camera-math.js';

test('zoom : facteur sur l\'altitude, jamais sous le plancher', () => {
  assert.equal(zoomStep(1000, 0.5), 500);
  assert.equal(zoomStep(1000, 2), -1000);
  assert.equal(zoomStep(15, 0.1), 15 - MIN_ALTITUDE_M);
});

test('tangage borné et vue 3/4', () => {
  assert.equal(clampPitch(-120), PITCH_MIN_DEG);
  assert.equal(clampPitch(0), PITCH_MAX_DEG);
  assert.equal(pitchForTilt(true), TILT_PITCH_DEG);
  assert.equal(pitchForTilt(false), PITCH_MIN_DEG);
});

test('déplacement : plus fin près du sol, borné loin', () => {
  const near = moveAngles(1, 1, 1000), far = moveAngles(1, 0, 1e9);
  assert.ok(near.right < 1e-3 && near.right > 0);
  assert.equal(far.right, 1);
  assert.equal(far.forward, 0);
});

test('cap ramené entre 0 et 360', () => {
  assert.equal(wrapHeading(-10), 350);
  assert.equal(wrapHeading(370), 10);
});
