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

import {
  buildGaiaAstrometricCovariance,
  gaiaDR3RowToAstrometricRecord,
  propagateAstrometricPositionCovariance,
} from './AstrometricEngine.js';

test('construit une covariance Gaia 5x5 avec corrélations symétriques', () => {
  const covariance = buildGaiaAstrometricCovariance({
    ra_error: 2, dec_error: 3, parallax_error: 4, pmra_error: 5, pmdec_error: 6,
    ra_dec_corr: 0.5, pmra_pmdec_corr: -0.25,
  });
  assert.equal(covariance.length, 5);
  assert.equal(covariance[0][0], 4);
  assert.equal(covariance[0][1], 3);
  assert.equal(covariance[1][0], 3);
  assert.equal(covariance[3][4], -7.5);
});

test('rejette les coefficients de corrélation Gaia hors intervalle', () => {
  assert.throws(() => buildGaiaAstrometricCovariance({
    ra_error: 1, dec_error: 1, parallax_error: 1, pmra_error: 1, pmdec_error: 1,
    ra_dec_corr: 1.2,
  }), /ra_dec_corr/);
});

test('normalise une ligne Gaia DR3 avec covariance et provenance', () => {
  const row = {
    source_id: '123456', ref_epoch: 2016, ra: 217.4, dec: -62.6,
    parallax: 768, pmra: -3781, pmdec: 769, radial_velocity: -20,
    ra_error: 0.1, dec_error: 0.1, parallax_error: 0.02, pmra_error: 0.03, pmdec_error: 0.03,
    radial_velocity_error: 0.2, astrometric_params_solved: 31,
  };
  const result = gaiaDR3RowToAstrometricRecord(row);
  assert.equal(result.id, 'gaia-dr3:123456');
  assert.equal(result.coordinates.epoch, 2016);
  assert.equal(result.astrometry.covariance.length, 6);
  assert.equal(result.provenance.catalog, 'gaiadr3.gaia_source');
});

test('propage la covariance Gaia vers une covariance 3D finie en pc²', () => {
  const row = {
    source_id: '123456', ref_epoch: 2016, ra: 217.4, dec: -62.6,
    parallax: 768, pmra: -3781, pmdec: 769, radial_velocity: -20,
    ra_error: 0.1, dec_error: 0.1, parallax_error: 0.02, pmra_error: 0.03, pmdec_error: 0.03,
    ra_dec_corr: 0.2, dec_parallax_corr: -0.1, pmra_pmdec_corr: 0.3,
  };
  const normalized = gaiaDR3RowToAstrometricRecord(row);
  const result = propagateAstrometricPositionCovariance(normalized, 2026);
  assert.equal(result.covariancePc2.length, 3);
  assert.equal(result.parameterOrder.length, 5);
  assert.ok(result.sigmaPc.x > 0);
  assert.ok(result.sigmaPc.y > 0);
  assert.ok(result.sigmaPc.z > 0);
  assert.ok(result.covariancePc2.flat().every(Number.isFinite));
});

test('la propagation standard inclut les incertitudes si une covariance est fournie', () => {
  const normalized = gaiaDR3RowToAstrometricRecord({
    source_id: '123456', ref_epoch: 2016, ra: 10, dec: 20,
    parallax: 100, pmra: 10, pmdec: 20, radial_velocity: 5,
    ra_error: 1, dec_error: 1, parallax_error: 0.2, pmra_error: 0.1, pmdec_error: 0.1,
  });
  const result = propagateAstrometricCoordinates(normalized, 2026);
  assert.equal(result.positionUncertainty.method, 'linearized-jacobian');
  assert.equal(result.positionUncertainty.covariancePc2.length, 3);
});

test('inclut l’incertitude de vitesse radiale dans une covariance 6x6', () => {
  const normalized = gaiaDR3RowToAstrometricRecord({
    source_id: '123456', ref_epoch: 2016, ra: 10, dec: 20,
    parallax: 100, pmra: 10, pmdec: 20, radial_velocity: 5, radial_velocity_error: 0.5,
    ra_error: 1, dec_error: 1, parallax_error: 0.2, pmra_error: 0.1, pmdec_error: 0.1,
  });
  const result = propagateAstrometricPositionCovariance(normalized, 2026);
  assert.equal(result.parameterOrder[5], 'radial_velocity');
});
