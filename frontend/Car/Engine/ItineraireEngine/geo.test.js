import test from 'node:test';
import assert from 'node:assert/strict';
import { bearingDeg, chaikin, fitProjection, haversineKm, latLonToVec, lerpGreatCircle, pointAt, polylineKm, sampleAlong, unwrapLongitudes, vecToLatLon } from './geo.js';

const paris = { lat: 48.8566, lon: 2.3522 }, ny = { lat: 40.7128, lon: -74.006 };

test('distance Paris–New York ≈ 5 837 km', () => {
  assert.ok(Math.abs(haversineKm(paris, ny) - 5837) < 30);
  assert.equal(haversineKm(paris, paris), 0);
  assert.ok(Math.abs(polylineKm([paris, { lat: 0, lon: 0 }, ny]) - (haversineKm(paris, { lat: 0, lon: 0 }) + haversineKm({ lat: 0, lon: 0 }, ny))) < 1e-6);
});

test('vecteur ↔ position, et grand cercle', () => {
  const back = vecToLatLon(latLonToVec(48.8566, 2.3522, 3));
  assert.ok(Math.abs(back.lat - 48.8566) < 1e-9 && Math.abs(back.lon - 2.3522) < 1e-9);
  const mid = lerpGreatCircle(paris, ny, 0.5);
  assert.ok(Math.abs(haversineKm(paris, mid) - haversineKm(mid, ny)) < 1);
  assert.ok(mid.lat > 48, 'le grand cercle Paris–New York monte vers le nord');
  assert.deepEqual(lerpGreatCircle(paris, paris, 0.3), { lat: paris.lat, lon: paris.lon });
});

test('cap : vers l’est = 90°, vers le nord = 0°', () => {
  assert.ok(Math.abs(bearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 90) < 1e-6);
  assert.ok(Math.abs(bearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }) - 0) < 1e-6);
});

test('rééchantillonnage : n points équidistants, extrémités conservées', () => {
  const pts = sampleAlong([paris, { lat: 50, lon: 5 }, ny], 50);
  assert.equal(pts.length, 50);
  assert.ok(haversineKm(pts[0], paris) < 1e-6 && haversineKm(pts[49], ny) < 1e-6);
  assert.ok(Math.abs(pts[49].d - polylineKm([paris, { lat: 50, lon: 5 }, ny])) < 1e-6);
  const step = pts[1].d - pts[0].d;
  for (let i = 2; i < 50; i++) assert.ok(Math.abs(pts[i].d - pts[i - 1].d - step) < 1e-6);
  assert.equal(sampleAlong([paris, paris], 5).length, 5);
});

test('Chaikin garde les extrémités et ajoute des points', () => {
  const raw = [{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }, { lat: 0, lon: 2 }];
  const out = chaikin(raw, 2);
  assert.deepEqual(out[0], raw[0]);
  assert.deepEqual(out[out.length - 1], raw[2]);
  assert.ok(out.length > raw.length);
  assert.equal(chaikin(raw, 0), raw);
});

test('longitudes continues à l’antiméridien', () => {
  const out = unwrapLongitudes([{ lat: 0, lon: 170 }, { lat: 0, lon: -170 }]);
  assert.equal(out[1].lon, 190);
});

test('projection : tout tient dans le cadre, même pour un tracé minuscule', () => {
  const pts = [paris, ny].map((p) => ({ ...p }));
  const { project } = fitProjection(pts, 400, 300, 20);
  for (const p of pts) { const [x, y] = project(p); assert.ok(x >= 19 && x <= 381 && y >= 19 && y <= 281, `${x},${y}`); }
  const tiny = fitProjection([{ lat: 48, lon: 2 }, { lat: 48, lon: 2 }], 400, 300, 20).project({ lat: 48, lon: 2 });
  assert.ok(Number.isFinite(tiny[0]) && Number.isFinite(tiny[1]));
});

test('point à la fraction u : interpolé, avec cap et altitude', () => {
  const pts = [{ lat: 0, lon: 0, alt: 0 }, { lat: 0, lon: 1, alt: 10 }, { lat: 0, lon: 2, alt: 0 }];
  assert.equal(pointAt(pts, 0).lon, 0);
  assert.equal(pointAt(pts, 0.5).alt, 10);
  assert.equal(pointAt(pts, 1).lon, 2);
  assert.equal(pointAt(pts, 0.25).lon, 0.5);
  assert.ok(Math.abs(pointAt(pts, 0.1).heading - 90) < 1e-6);
});

test('exagération d’altitude : 11 km sont élevés à 4 % du rayon, une fusée à 200 km n’est presque pas exagérée', async () => {
  const { altitudeScale } = await import('./geo.js');
  assert.ok(Math.abs(altitudeScale(11) * 11 / 6371 - 0.04) < 1e-9);
  assert.ok(altitudeScale(200) < 2);
  assert.equal(altitudeScale(5000), 1);
  assert.equal(altitudeScale(0), 1);
});
