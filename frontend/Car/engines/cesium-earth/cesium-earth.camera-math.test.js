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

// Importe les gestes du globe.
import { KEY_ROTATE_SPEED, dragMove, keyMove, surfaceRotation } from './cesium-earth.camera-math.js';
// Importe la conversion du glisser de three.js, pour comparer.
import { dragRadPerPx, dragStep } from '../../Engine/AstreSolideEngine/InputEngine/touchMath.jsx';

// rodrigues : tourne v de +a (sens direct) autour de l'axe unitaire k.
const rodrigues = (v, k, a) => {
  const c = Math.cos(a), s = Math.sin(a), d = k[0] * v[0] + k[1] * v[1] + k[2] * v[2];
  const x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + x[i] * s + k[i] * d * (1 - c));
};

test('gestes : glisser identique à la scène three.js (sol sous le doigt, vue 3/4)', () => {
  // 1 000 km d'altitude, ouverture 45°, écran de 900 px, regard vertical.
  const m = dragMove(30, -20, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -90 });
  // Même résultat que three.js.
  const ref = dragStep(30, -20, dragRadPerPx(1e6 / EARTH_RADIUS_M, 45, 900), 0);
  assert.ok(Math.abs(m.right - ref.right) < 1e-15 && Math.abs(m.forward - ref.forward) < 1e-15);
  // Doigt vers la droite : la caméra part à gauche.
  assert.ok(m.right < 0);
  // Vue inclinée de 60° : déplacement vertical agrandi.
  const tilted = dragMove(0, 10, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -30 });
  const flat = dragMove(0, 10, { altitudeM: 1e6, fovyRad: Math.PI / 4, viewportH: 900, pitchDeg: -90 });
  assert.ok(tilted.forward > flat.forward * 1.9);
});

test('gestes : flèches maintenues, même vitesse que three.js, plus fines près du sol', () => {
  // Haut et droite pendant 100 ms, à 1 000 km.
  const m = keyMove({ up: true, right: true }, 100, 1e6);
  // Pas attendu.
  const step = 0.1 * KEY_ROTATE_SPEED * Math.min(1, (0.9 * 1e6) / EARTH_RADIUS_M);
  assert.ok(Math.abs(m.forward - step) < 1e-15 && Math.abs(m.right - step) < 1e-15);
  // Gauche et droite ensemble : rien horizontalement.
  assert.equal(keyMove({ left: true, right: true }, 50, 1e6).right, 0);
  // Retour d'onglet (dt énorme) : borné à 100 ms.
  assert.equal(keyMove({ up: true }, 5000, 1e6).forward, step);
});

test('gestes : rotation qui déplace la caméra vers le haut et la droite de l\'écran posés sur le sol', () => {
  // Caméra au-dessus de l'équateur, longitude 0, cap nord.
  const p = { x: 7e6, y: 0, z: 0 };
  // Vers le haut de l'écran (nord) de 0,1 rad.
  const up = surfaceRotation(p, 0, 0, 0.1);
  // CesiumJS tourne de −angle autour de l'axe : on applique +0,1 en sens direct.
  const moved = rodrigues([1, 0, 0], up.axis, -up.angle);
  // La caméra est montée vers le nord (z > 0) et n'a pas bougé en longitude.
  assert.ok(Math.abs(moved[2] - Math.sin(0.1)) < 1e-12 && Math.abs(moved[1]) < 1e-12);
  // Vers la droite de l'écran avec le cap nord : vers l'est (y > 0).
  const right = surfaceRotation(p, 0, 0.1, 0);
  assert.ok(rodrigues([1, 0, 0], right.axis, -right.angle)[1] > 0.09);
  // Cap est (90°) : le haut de l'écran est l'est.
  const east = surfaceRotation(p, Math.PI / 2, 0, 0.1);
  assert.ok(rodrigues([1, 0, 0], east.axis, -east.angle)[1] > 0.09);
  // Rien à faire : null.
  assert.equal(surfaceRotation(p, 0, 0, 0), null);
  // Au pôle exact : pas de NaN.
  const pole = surfaceRotation({ x: 0, y: 0, z: 7e6 }, 0, 0, 0.1);
  assert.ok(pole.axis.every(Number.isFinite));
});

// Importe la rotation automatique et l'ombre du globe.
import { AUTO_ROTATE_SPEED, autoRotateAngle, cesiumShade } from './cesium-earth.camera-math.js';

test('rotation automatique : même vitesse que three.js, multiplicateur, ralentie près du sol', () => {
  // Une seconde (bornée à 100 ms), multiplicateur 2, au-dessus d'un rayon terrestre : vitesse pleine.
  assert.ok(Math.abs(autoRotateAngle(100, 2, 2 * EARTH_RADIUS_M) - AUTO_ROTATE_SPEED * 2 * 0.1) < 1e-15);
  // Retour d'onglet : borné à 100 ms.
  assert.equal(autoRotateAngle(5000, 1, 2 * EARTH_RADIUS_M), autoRotateAngle(100, 1, 2 * EARTH_RADIUS_M));
  // À un dixième de rayon d'altitude : dix fois plus lent.
  assert.ok(Math.abs(autoRotateAngle(100, 1, 0.1 * EARTH_RADIUS_M) - AUTO_ROTATE_SPEED * 0.01) < 1e-15);
});

test('ombre du globe : coupée à 0, face nuit à l\'obscurité de CesiumJS à 1, fondu entre les deux', () => {
  assert.deepEqual(cesiumShade(0), { enableLighting: false, vertexShadowDarkness: 1 });
  assert.deepEqual(cesiumShade(1), { enableLighting: true, vertexShadowDarkness: 0.3 });
  assert.ok(Math.abs(cesiumShade(0.5).vertexShadowDarkness - 0.65) < 1e-12 && cesiumShade(0.5).enableLighting);
  // Valeur illisible : ombre pleine.
  assert.equal(cesiumShade(undefined).enableLighting, true);
});
