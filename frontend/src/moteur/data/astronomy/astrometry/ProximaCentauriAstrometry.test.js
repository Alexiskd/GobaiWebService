import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROXIMA_CENTAURI_ASTROMETRY,
  createProximaCentauriAstrometricRecord,
  calculateProximaCentauriPosition,
  propagateProximaCentauriRecord,
} from './ProximaCentauriAstrometry.js';

test('Proxima a un identifiant Gaia DR3 croisé sans confondre la source des mesures', () => {
  assert.equal(PROXIMA_CENTAURI_ASTROMETRY.identifiers[0].value, '5853498713190525696');
  assert.equal(PROXIMA_CENTAURI_ASTROMETRY.provenance.provider, 'CDS SIMBAD');
  assert.match(PROXIMA_CENTAURI_ASTROMETRY.provenance.caveat, /pas une ligne Gaia DR3 brute/);
});

test('le record Proxima est cloné sans muter le jeu de référence', () => {
  const record = createProximaCentauriAstrometricRecord({ name: 'Proxima test' });
  assert.equal(record.name, 'Proxima test');
  assert.equal(record.coordinates.epoch, 2000);
  assert.equal(PROXIMA_CENTAURI_ASTROMETRY.name, 'Proxima Centauri');
});

test('la position 3D à époque J2000 retrouve la distance issue de la parallaxe', () => {
  const result = calculateProximaCentauriPosition(2000);
  assert.ok(Math.abs(result.distancePc - 1000 / 768.0665) < 1e-10);
  assert.ok(Math.abs(result.distanceLightYears - 4.247) < 0.01);
  assert.equal(result.method, 'space-motion-3d');
  assert.ok(Number.isFinite(result.heliocentricParsecs.x));
});

test('la propagation tient compte du mouvement propre et de la vitesse radiale', () => {
  const j2000 = calculateProximaCentauriPosition(2000);
  const j2026 = calculateProximaCentauriPosition(2026);
  assert.notEqual(j2000.raDeg, j2026.raDeg);
  assert.notEqual(j2000.decDeg, j2026.decDeg);
  assert.ok(j2026.distancePc < j2000.distancePc, 'Proxima approche le Soleil selon la vitesse radiale négative');
  assert.ok(j2026.totalSpaceVelocityKmS > j2026.tangentialVelocityKmS);
});

test('la position scène respecte l’échelle fournie', () => {
  const result = calculateProximaCentauriPosition(2026, { parsecToSceneUnits: 1000 });
  assert.ok(Math.abs(result.scenePosition.x - result.heliocentricParsecs.x * 1000) < 1e-8);
  assert.ok(Math.abs(result.scenePosition.y - result.heliocentricParsecs.z * 1000) < 1e-8);
  assert.ok(Math.abs(result.scenePosition.z + result.heliocentricParsecs.y * 1000) < 1e-8);
});

test('la fonction expose un record propagé au format du catalogue', () => {
  const result = propagateProximaCentauriRecord(2026);
  assert.equal(result.coordinates.epoch, 2026);
  assert.equal(result.propagation.method, 'space-motion-3d');
  assert.ok(result.propagation.distancePc > 0);
});
