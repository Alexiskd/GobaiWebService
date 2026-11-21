import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateExoplanetBatch,
  calculateExoplanetPosition,
  calculateExoplanetRecordPosition,
  solveKeplerEquation,
} from './ExoplanetOrbitalEngine.js';

const circular = (overrides = {}) => ({
  periodDays: 365.25, semiMajorAxisAu: 1, eccentricity: 0,
  inclinationDeg: 0, longitudeAscendingNodeDeg: 0, argumentOfPeriastronDeg: 0,
  meanAnomalyAtEpochDeg: 0, epochJulianDate: 2451545,
  ...overrides,
});

test('résout Kepler pour une orbite circulaire', () => {
  const result = solveKeplerEquation(1.2, 0);
  assert.equal(result.converged, true);
  assert.ok(Math.abs(result.eccentricAnomalyRad - 1.2) < 1e-12);
});

test('résout Kepler pour une excentricité élevée', () => {
  const result = solveKeplerEquation(2.1, 0.95);
  assert.ok(Math.abs(result.eccentricAnomalyRad - 0.95 * Math.sin(result.eccentricAnomalyRad) - 2.1) < 1e-10 || Math.abs(result.residual) < 1e-10);
});

test('position d’une orbite circulaire au périastre (x=a)', () => {
  const result = calculateExoplanetPosition(circular(), 2451545);
  assert.ok(Math.abs(result.position.x - 1) < 1e-12);
  assert.ok(Math.abs(result.position.y) < 1e-12);
  assert.ok(Math.abs(result.position.z) < 1e-12);
  assert.equal(result.units.position, 'AU');
});

test('avance d’un quart de période sur une orbite circulaire', () => {
  const result = calculateExoplanetPosition(circular(), 2451545 + 365.25 / 4);
  assert.ok(Math.abs(result.position.x) < 1e-10);
  assert.ok(Math.abs(result.position.y - 1) < 1e-10);
});

test('respecte le temps de passage au périastre fourni en JD', () => {
  const orbit = circular({ meanAnomalyAtEpochDeg: undefined, epochJulianDate: undefined, periastronEpochJulianDate: 2451545, eccentricity: 0.2 });
  const result = calculateExoplanetPosition(orbit, 2451545);
  assert.ok(Math.abs(result.position.x - 0.8) < 1e-10);
  assert.equal(result.epochSource, 'periastron-epoch-jd');
});

test('applique les rotations d’orientation orbitale', () => {
  const result = calculateExoplanetPosition(circular({ inclinationDeg: 90 }), 2451545 + 365.25 / 4);
  assert.ok(Math.abs(result.position.y) < 1e-10);
  assert.ok(Math.abs(result.position.z - 1) < 1e-10);
});

test('dérive le demi-grand axe à partir de la masse stellaire', () => {
  const orbit = circular({ semiMajorAxisAu: null, periodDays: 365.25 });
  const result = calculateExoplanetPosition(orbit, 2451545, { centralMassSolar: 1 });
  assert.ok(Math.abs(result.orbitalState.semiMajorAxisAu - 1) < 1e-8);
  assert.equal(result.warnings.length, 1);
});

test('dérive le paramètre gravitationnel depuis la période si masse absente', () => {
  const result = calculateExoplanetPosition(circular(), 2451545);
  assert.ok(Number.isFinite(result.velocity.y));
  assert.ok(result.velocity.y > 0);
});

test('convertit longitude du périastre en argument si Ω est connu', () => {
  const result = calculateExoplanetPosition(circular({ longitudeAscendingNodeDeg: 30, longitudePeriastronDeg: 70, argumentOfPeriastronDeg: undefined }), 2451545);
  assert.equal(result.orbitalState.argumentOfPeriastronDeg, 40);
});

test('accepte un enregistrement NASA normalisé avec phase explicite ajoutée', () => {
  const record = { id: 'nasa-exoplanet:test-b', kind: 'exoplanet', orbit: circular() };
  const result = calculateExoplanetRecordPosition(record, 2451545);
  assert.equal(result.bodyId, record.id);
});

test('traite un lot de planètes', () => {
  const records = [
    { id: 'planet-a', kind: 'exoplanet', orbit: circular() },
    { id: 'planet-b', kind: 'exoplanet', orbit: circular({ semiMajorAxisAu: 2 }) },
  ];
  assert.equal(calculateExoplanetBatch(records, 2451545).length, 2);
});

test('rejette les paramètres non elliptiques ou incomplets', () => {
  assert.throws(() => solveKeplerEquation(1, 1), /eccentricity/);
  assert.throws(() => calculateExoplanetPosition(circular({ eccentricity: 1 }), 2451545), /orbites elliptiques/);
  assert.throws(() => calculateExoplanetPosition(circular({ periodDays: 0 }), 2451545), /periodDays/);
  assert.throws(() => calculateExoplanetPosition(circular({ meanAnomalyAtEpochDeg: null, epochJulianDate: null }), 2451545), /periastronEpoch/);
  assert.throws(() => calculateExoplanetPosition(circular({ semiMajorAxisAu: null }), 2451545), /centralMassSolar/);
});

test('rejette les enregistrements et lots invalides', () => {
  assert.throws(() => calculateExoplanetRecordPosition(null, 2451545), /enregistrement/);
  assert.throws(() => calculateExoplanetBatch({}, 2451545), /tableau/);
});

test('gère une anomalie moyenne négative sans résidu de 2π', () => {
  const result = solveKeplerEquation(-1.1, 0.7);
  assert.ok(Math.abs(result.residual) < 1e-10);
  assert.ok(result.eccentricAnomalyRad >= 0 && result.eccentricAnomalyRad < 2 * Math.PI);
});

test('reste stable pour une orbite très excentrique', () => {
  const result = solveKeplerEquation(0.001, 0.999);
  assert.equal(result.converged, true);
  assert.ok(Math.abs(result.residual) < 1e-10);
});


test('signale la convention NASA et le temps de périastre brut non utilisé', () => {
  const record = {
    id: 'nasa-exoplanet:example-b', kind: 'exoplanet',
    orbit: { ...circular(), argumentOfPeriastronConvention: 'NASA as-reported', timeOfPeriastronRawDays: 2459000.5 },
  };
  const result = calculateExoplanetRecordPosition(record, 2451545);
  assert.equal(result.warnings.length, 2);
  assert.match(result.warnings[0], /planète versus mouvement réflexe/);
  assert.match(result.warnings[1], /temps de périastre NASA brut/);
});
