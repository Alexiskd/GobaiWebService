import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  solveKepler, keplerPositionFromElements, heliocentricEcliptic,
  heliocentricState, centuriesTT,
} from './planetOrbits.jsx';
import { PLANETS } from '../SystemeEngine/data/astronomy/data/bodies.data';

test('résout correctement l’équation de Kepler', () => {
  for (const e of [0, 0.0167, 0.0549, 0.6, 0.9]) {
    const M = 1.234;
    const E = solveKepler(M, e);
    assert.ok(Math.abs(E - e * Math.sin(E) - M) < 1e-12);
  }
});

test('une orbite circulaire conserve son rayon', () => {
  for (let i = 0; i < 32; i++) {
    const p = keplerPositionFromElements({ a: 1000, e: 0, meanAnomaly: i * Math.PI / 16 });
    assert.ok(Math.abs(Math.hypot(...p) - 1000) < 1e-9);
  }
});

test('les planètes sont calculées par Kepler dans le référentiel héliocentrique', () => {
  const T = centuriesTT(Date.UTC(2026, 0, 1));
  for (const planet of PLANETS) {
    const position = heliocentricEcliptic(planet.elements, T);
    const state = heliocentricState(planet.elements, T);
    assert.equal(position.length, 3);
    assert.ok(position.every(Number.isFinite));
    assert.ok(state.velocity.every(Number.isFinite));
    assert.ok(Math.hypot(...position) > 0);
  }
});

test('les orbites elliptiques rejettent une excentricité non physique', () => {
  assert.throws(() => keplerPositionFromElements({ a: 1, e: 1 }), /exige/);
});
