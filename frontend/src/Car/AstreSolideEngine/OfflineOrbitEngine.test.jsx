import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSatelliteRelativeKm, calculatePlanetPosition, OfflineOrbitEngine } from './OfflineOrbitEngine.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('satellite offline propagation preserves semi-major axis and period', () => {
  const def = { id: 'io', aKm: 421800, periodDays: 1.769138 };
  const t0 = Date.UTC(2000, 0, 1, 12);
  const p0 = calculateSatelliteRelativeKm(def, t0);
  const p1 = calculateSatelliteRelativeKm(def, t0 + def.periodDays * 86400000);
  near(Math.hypot(p0.x, p0.y, p0.z), def.aKm);
  near(p0.x, p1.x, 1e-5);
  near(p0.y, p1.y, 1e-5);
});

test('negative sidereal period propagates retrograde satellites', () => {
  const def = { id: 'triton', aKm: 354760, periodDays: -5.876854 };
  const t0 = Date.UTC(2000, 0, 1, 12);
  const p0 = calculateSatelliteRelativeKm(def, t0);
  const p1 = calculateSatelliteRelativeKm(def, t0 + 100000);
  assert.ok(p0.y * p1.y < 0 || p1.x < p0.x, 'phase advances in retrograde direction');
});

test('offline engine reports no network dependency and computes a planet', () => {
  const engine = new OfflineOrbitEngine();
  const def = { earth: true, elements: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0] };
  const p = engine.planet(def, 0);
  assert.equal(p.length, 3);
  assert.ok(p.every(Number.isFinite));
  assert.equal(engine.getStatus().networkRequired, false);
  assert.equal(calculatePlanetPosition(def, 0).length, 3);
});
