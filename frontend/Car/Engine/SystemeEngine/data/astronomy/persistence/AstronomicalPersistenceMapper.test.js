import test from 'node:test';
import assert from 'node:assert/strict';
import { mapStarSystemForPersistence, mapPositionSample } from './AstronomicalPersistenceMapper.js';

const fixture = (hostGaiaDr3Id = '123456789') => ({
  id: 'system-1', kind: 'star-system', schemaVersion: 1,
  star: { id: 'gaia:123456789', name: 'Test Star', canonicalIdentifier: { catalog: 'Gaia DR3', value: '123456789' }, coordinates: { raDeg: 12, decDeg: -4, epoch: 2016 }, astrometry: { parallaxMas: 10, pmRaMasYr: 2, pmDecMasYr: -1 }, provenance: [], sourceRecords: [] },
  planets: [{ id: 'Planet b', name: 'Planet b', host: { name: 'Test Star', gaiaDr3Id: hostGaiaDr3Id }, orbit: { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0.02 }, physical: { radiusEarth: 1.2 } }],
});

test('mappe un système stellaire vers les colonnes SQL et conserve les charges sources', () => {
  const mapped = mapStarSystemForPersistence(fixture());
  assert.equal(mapped.star.canonicalKey, 'gaia:123456789');
  assert.equal(mapped.star.raDeg, 12);
  assert.equal(mapped.planets[0].hostLinkStatus, 'verified-gaia-id');
  assert.equal(mapped.planets[0].semiMajorAxisAu, 0.1);
});

test('ne crée pas de lien hôte si les identifiants Gaia diffèrent', () => {
  const mapped = mapStarSystemForPersistence(fixture('999'));
  assert.equal(mapped.planets[0].hostLinkStatus, 'unresolved');
  assert.equal(mapped.planets[0].hostStarCanonicalKey, null);
});

test('refuse un objet qui ne représente pas un système stellaire', () => {
  assert.throws(() => mapStarSystemForPersistence({ kind: 'planet' }), /star-system/);
});

test('valide et normalise les échantillons de position', () => {
  const row = mapPositionSample({ objectKey: 'gaia:1', epochJulianDate: 2460000.5, frame: 'ICRS', position: { x: 1, y: 2, z: 3 } });
  assert.equal(row.z, 3);
  assert.equal(row.vx, null);
  assert.throws(() => mapPositionSample({ objectKey: 'x', epochJulianDate: 1, frame: 'UNKNOWN', position: { x: 0, y: 0, z: 0 } }), /repère/);
});

test('utilise le même identifiant de repère GOBAI-SCENE que la contrainte PostgreSQL', () => {
  const row = mapPositionSample({ objectKey: 'system:planet', epochJulianDate: 2460000.5, frame: 'GOBAI-SCENE', position: { x: 1, y: 2, z: 3 }, units: 'scene units' });
  assert.equal(row.frame, 'GOBAI-SCENE');
  assert.throws(() => mapPositionSample({ objectKey: 'system:planet', epochJulianDate: 2460000.5, frame: 'GOBAl-SCENE', position: { x: 1, y: 2, z: 3 } }), /repère/);
});
