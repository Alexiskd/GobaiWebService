import test from 'node:test';
import assert from 'node:assert/strict';
import { angularSeparationArcsec, resolveAstronomicalCrossReferences } from './AstronomicalCrossReferenceResolver.js';

const gaia = (id, ra = 10, dec = 20) => ({ id: `gaia-dr3:${id}`, kind: 'star', source: 'ESA Gaia DR3', sourceId: String(id), name: null, coordinates: { frame: 'ICRS', epoch: 2016, raDeg: ra, decDeg: dec }, identifiers: [{ catalog: 'Gaia DR3', value: String(id) }] });
const simbad = (name, ra = 10, dec = 20) => ({ id: `simbad:${name.toLowerCase()}`, kind: 'astronomical-object', source: 'CDS SIMBAD', name, coordinates: { frame: 'ICRS', epoch: null, raDeg: ra, decDeg: dec }, identifiers: [{ catalog: 'SIMBAD', value: name }] });

test('calcule une séparation angulaire nulle pour des coordonnées identiques', () => {
  assert.equal(angularSeparationArcsec({ raDeg: 10, decDeg: 20 }, { raDeg: 10, decDeg: 20 }), 0);
});

test('calcule correctement une séparation traversant zéro heure d’ascension droite', () => {
  const separation = angularSeparationArcsec({ raDeg: 359.999, decDeg: 0 }, { raDeg: 0.001, decDeg: 0 });
  assert.ok(Math.abs(separation - 7.2) < 0.001);
});

test('retourne null si les coordonnées sont incomplètes ou invalides', () => {
  assert.equal(angularSeparationArcsec({ raDeg: 10 }, { raDeg: 11, decDeg: 0 }), null);
  assert.equal(angularSeparationArcsec({ raDeg: 10, decDeg: 91 }, { raDeg: 11, decDeg: 0 }), null);
});

test('lie automatiquement deux enregistrements partageant exactement un identifiant Gaia DR3', () => {
  const result = resolveAstronomicalCrossReferences([gaia('123'), { ...gaia('123'), id: 'gaia-copy:123', source: 'import' }]);
  assert.equal(result.entities.length, 1);
  assert.equal(result.links[0].automatic, true);
  assert.equal(result.links[0].relation, 'same-gaia-dr3-source');
});

test('garde une correspondance SIMBAD/Gaia par coordonnées comme candidate à vérifier', () => {
  const result = resolveAstronomicalCrossReferences([gaia('123'), simbad('Alpha Example', 10.0001, 20)]);
  assert.equal(result.entities.length, 2);
  assert.equal(result.links.length, 1);
  assert.equal(result.links[0].automatic, false);
  assert.equal(result.links[0].confidence, 'candidate-review-required');
  assert.ok(result.links[0].evidence.separationArcsec > 0);
});

test('ne fusionne pas deux étoiles proches si elles ne partagent pas un identifiant', () => {
  const result = resolveAstronomicalCrossReferences([gaia('123'), gaia('456', 10.00001, 20)]);
  assert.equal(result.entities.length, 2);
  assert.equal(result.links.length, 0);
});

test('lie une exoplanète à son hôte uniquement par identifiant Gaia exact', () => {
  const planet = { id: 'nasa-exoplanet:example-b', kind: 'exoplanet', name: 'Example b', host: { name: 'Example', gaiaDr3Id: '123' } };
  const result = resolveAstronomicalCrossReferences([gaia('123'), planet]);
  assert.equal(result.planetHostLinks[0].status, 'linked-by-gaia-id');
  assert.equal(result.links[0].relation, 'orbits-star');
  assert.equal(result.links[0].automatic, true);
});

test('un nom hôte identique sans Gaia ID ne crée qu’un candidat manuel', () => {
  const star = { ...simbad('Example'), kind: 'astronomical-object' };
  const planet = { id: 'nasa-exoplanet:example-b', kind: 'exoplanet', name: 'Example b', host: { name: 'Example', gaiaDr3Id: null } };
  const result = resolveAstronomicalCrossReferences([star, planet]);
  assert.equal(result.planetHostLinks[0].status, 'candidate-host-name');
  assert.equal(result.links[0].automatic, false);
});

test('refuse un rayon de correspondance excessif', () => {
  assert.throws(() => resolveAstronomicalCrossReferences([], { coordinateToleranceArcsec: 61 }), /compris entre 0 et 60/);
});

test('refuse un conteneur de records qui n’est pas un tableau', () => {
  assert.throws(() => resolveAstronomicalCrossReferences(null), /records doit être un tableau/);
});
