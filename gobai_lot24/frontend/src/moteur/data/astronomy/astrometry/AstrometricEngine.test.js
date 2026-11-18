import test from 'node:test';
import assert from 'node:assert/strict';
import {
  propagateAstrometricCoordinates,
  propagateAstrometricRecord,
  propagateAstrometricBatch,
} from './AstrometricEngine.js';

const record = (overrides = {}) => ({
  id: 'gaia-dr3:123',
  kind: 'star',
  coordinates: { frame: 'ICRS', epoch: 2016, raDeg: 10, decDeg: 20 },
  astrometry: { parallaxMas: 100, properMotionRaMasYr: 0, properMotionDecMasYr: 0, radialVelocityKmS: 0 },
  ...overrides,
});

test('une propagation à la même époque conserve la position', () => {
  const result = propagateAstrometricCoordinates(record(), 2016);
  assert.ok(Math.abs(result.raDeg - 10) < 1e-10);
  assert.ok(Math.abs(result.decDeg - 20) < 1e-10);
  assert.equal(result.method, 'space-motion-3d');
});

test('la propagation tangentielle suit le mouvement propre en ascension droite', () => {
  const input = record({ astrometry: { properMotionRaMasYr: 1000, properMotionDecMasYr: 0 } });
  const result = propagateAstrometricCoordinates(input, 2017);
  const expected = 1000 / 3600000 / Math.cos(20 * Math.PI / 180);
  assert.ok(Math.abs(result.raDeg - (10 + expected)) < 1e-7);
});

test('la propagation tangentielle suit le mouvement propre en déclinaison', () => {
  const input = record({ astrometry: { properMotionRaMasYr: 0, properMotionDecMasYr: 3600 } });
  const result = propagateAstrometricCoordinates(input, 2017);
  assert.ok(Math.abs(result.decDeg - 20.001) < 1e-7);
});

test('normalise le passage de RA 360 vers 0 degrés', () => {
  const input = record({ coordinates: { frame: 'ICRS', epoch: 2016, raDeg: 359.9999, decDeg: 0 }, astrometry: { properMotionRaMasYr: 1000, properMotionDecMasYr: 0 } });
  const result = propagateAstrometricCoordinates(input, 2017);
  assert.ok(result.raDeg >= 0 && result.raDeg < 360);
});

test('la vitesse radiale modifie la distance et la parallaxe propagée', () => {
  const input = record({ astrometry: { parallaxMas: 100, properMotionRaMasYr: 0, properMotionDecMasYr: 0, radialVelocityKmS: 100 } });
  const result = propagateAstrometricCoordinates(input, 2026);
  assert.ok(result.distancePc > 10);
  assert.ok(result.parallaxMas < 100);
  assert.equal(result.used.radialVelocity, true);
});

test('sans parallaxe utilise une propagation tangentielle et émet un avertissement', () => {
  const input = record({ astrometry: { parallaxMas: null, properMotionRaMasYr: 100, properMotionDecMasYr: 0, radialVelocityKmS: 30 } });
  const result = propagateAstrometricCoordinates(input, 2020);
  assert.equal(result.method, 'tangent-plane-no-distance');
  assert.equal(result.distancePc, null);
  assert.equal(result.used.radialVelocity, false);
  assert.equal(result.warnings.length, 1);
});

test('préserve les métadonnées de l’enregistrement normalisé', () => {
  const input = record({ name: 'Test star', provenance: { provider: 'gaia' } });
  const result = propagateAstrometricRecord(input, 2020);
  assert.equal(result.name, 'Test star');
  assert.deepEqual(result.provenance, { provider: 'gaia' });
  assert.equal(result.coordinates.epoch, 2020);
  assert.ok(result.propagation);
});

test('propage un lot d’enregistrements', () => {
  const result = propagateAstrometricBatch([record(), record({ id: 'gaia-dr3:456' })], 2025);
  assert.equal(result.length, 2);
  assert.equal(result[0].coordinates.epoch, 2025);
});

test('rejette les coordonnées et époques invalides', () => {
  assert.throws(() => propagateAstrometricCoordinates(record({ coordinates: { epoch: 2016, raDeg: 0, decDeg: 91 } }), 2020), /decDeg/);
  assert.throws(() => propagateAstrometricCoordinates(record(), 'J2000'), /targetEpoch/);
  assert.throws(() => propagateAstrometricRecord(null, 2020), /enregistrement/);
  assert.throws(() => propagateAstrometricBatch({}, 2020), /tableau/);
});

test('accepte un mouvement propre manquant comme nul sans inventer une mesure', () => {
  const input = record({ astrometry: { parallaxMas: 50, properMotionRaMasYr: null, properMotionDecMasYr: null, radialVelocityKmS: null } });
  const result = propagateAstrometricCoordinates(input, 2020);
  assert.equal(result.used.properMotionRa, false);
  assert.equal(result.used.properMotionDec, false);
  assert.equal(result.used.radialVelocity, false);
  assert.equal(result.parallaxMas, 50);
});
