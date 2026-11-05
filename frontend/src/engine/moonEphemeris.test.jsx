import test from 'node:test';
import assert from 'node:assert/strict';
import { eclipticOf, interpolateState } from './moonEphemeris';

// Orbite circulaire inclinée de test : 384 400 km, période 27,32 j, table au pas de 30 min comme Horizons.
const R = 384400, P = 27.321661 * 86400e3, I = (5.14 * Math.PI) / 180;
const at = (t) => {
  const a = (2 * Math.PI * t) / P;
  return { t, x: R * Math.cos(a), y: R * Math.sin(a) * Math.cos(I), z: R * Math.sin(a) * Math.sin(I) };
};
const table = Array.from({ length: 100 }, (_, i) => at(i * 30 * 60e3));

test('Horizons : interpolation de Catmull-Rom précise au mètre entre deux points de la table', () => {
  let worst = 0;
  for (let t = table[1].t; t <= table[98].t; t += 7 * 60e3 + 13e3) {
    const p = interpolateState(table, t), e = at(t);
    worst = Math.max(worst, Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z));
  }
  assert.ok(worst < 5, `écart maximal ${worst.toFixed(2)} km`); // < 5 km garanti, ≈ quelques mètres en pratique
  assert.ok(worst < 0.05, `écart maximal ${(worst * 1000).toFixed(1)} m`);
});

test('Horizons : hors de la table → null (repli sur la théorie ELP)', () => {
  assert.equal(interpolateState(table, -1), null);
  assert.equal(interpolateState(table, table[99].t + 1), null);
  assert.equal(interpolateState(table.slice(0, 3), table[1].t), null);
});

test('Horizons : vecteur → longitude, latitude, distance', () => {
  const e = eclipticOf({ x: 0, y: 384400, z: 0 });
  assert.equal(e.distKm, 384400);
  assert.ok(Math.abs(e.lon - 90) < 1e-9 && Math.abs(e.lat) < 1e-9);
});
