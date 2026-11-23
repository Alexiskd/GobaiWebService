// Tests des calculs de la caméra du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { MIN_ALTITUDE_M, PITCH_MAX_DEG, PITCH_MIN_DEG, approachPitch, clampPitch, tiltEngagement, moveAngles, pitchForTilt, wrapHeading, zoomStep } from './cesium-earth.camera-math.js';

test('zoom : facteur sur l\'altitude, jamais sous le plancher', () => {
  assert.equal(zoomStep(1000, 0.5), 500);
  assert.equal(zoomStep(1000, 2), -1000);
  assert.equal(zoomStep(15, 0.1), 15 - MIN_ALTITUDE_M);
});

test('tangage borné et vue 3/4', () => {
  assert.equal(clampPitch(-120), PITCH_MIN_DEG);
  assert.equal(clampPitch(0), PITCH_MAX_DEG);
  assert.equal(pitchForTilt(false, 1000), PITCH_MIN_DEG);
});

test('vue 3/4 automatique : verticale loin du sol, ≈ 60° près du sol, comme three.js', () => {
  assert.equal(pitchForTilt(true, 15000e3), PITCH_MIN_DEG);
  assert.equal(tiltEngagement(3000e3), 0);
  assert.equal(tiltEngagement(100e3), 1);
  assert.equal(pitchForTilt(true, 100e3), PITCH_MAX_DEG);
  const mid = pitchForTilt(true, 1000e3);
  assert.ok(mid > PITCH_MIN_DEG && mid < PITCH_MAX_DEG);
  assert.ok(Math.abs(approachPitch(-90, -30, 1e6) + 30) < 1e-9);
  assert.equal(approachPitch(-90, -30, 0), -90);
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

// Importe la traduction ECEF → repère des tuiles de three.js.
import { EARTH_RADIUS_M, ecefToTilesLocal } from './cesium-earth.camera-math.js';
// Importe la longitude et la latitude d'une direction du repère des tuiles.
import { lonLatOf } from './cesium-earth.handoff.js';

test('fond transparent : ECEF de CesiumJS → repère des tuiles three.js, même longitude et latitude', () => {
  // Point au-dessus de Paris (2,35° E, 48,85° N), à 1 000 km d'altitude, en ECEF sphérique.
  const lon = (2.35 * Math.PI) / 180, lat = (48.85 * Math.PI) / 180, r = EARTH_RADIUS_M + 1e6;
  // Coordonnées ECEF.
  const p = { x: r * Math.cos(lat) * Math.cos(lon), y: r * Math.cos(lat) * Math.sin(lon), z: r * Math.sin(lat) };
  // Traduit.
  const local = ecefToTilesLocal(p);
  // Même lieu.
  const ll = lonLatOf(local);
  // Longitude et latitude retrouvées.
  assert.ok(Math.abs(ll.lon - 2.35) < 1e-9 && Math.abs(ll.lat - 48.85) < 1e-9);
  // Distance au centre en rayons terrestres.
  assert.ok(Math.abs(Math.hypot(...local) - r / EARTH_RADIUS_M) < 1e-12);
  // Une direction (échelle 1) garde sa longueur : le pôle Nord ECEF devient +Y.
  assert.deepEqual(ecefToTilesLocal({ x: 0, y: 0, z: 1 }, 1), [0, 1, -0]);
});
