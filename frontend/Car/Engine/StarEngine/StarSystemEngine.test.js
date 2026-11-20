import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarSystems, StarSystemEngine, createStarSystemEngine } from './StarSystemEngine.js';

const gaia = (id = '123', overrides = {}) => ({
  id: `gaia-dr3:${id}`, kind: 'star', source: 'ESA Gaia DR3', sourceId: id,
  coordinates: { frame: 'ICRS', epoch: 2016, raDeg: 10, decDeg: 20 },
  astrometry: { parallaxMas: 100, properMotionRaMasYr: 10, properMotionDecMasYr: -5, radialVelocityKmS: 12 },
  provenance: { provider: 'gaia', retrievedAt: '2026-01-01' }, ...overrides,
});
const simbad = (name = 'Example Star') => ({
  id: `simbad:${name.toLowerCase().replaceAll(' ', '-')}`, kind: 'astronomical-object', source: 'CDS SIMBAD', name,
  coordinates: { frame: 'ICRS', epoch: null, raDeg: 10, decDeg: 20 },
  identifiers: [{ catalog: 'Gaia DR3', value: '123' }],
});
const planet = (id = 'nasa-exoplanet:example-b', gaiaId = '123', overrides = {}) => ({
  id, kind: 'exoplanet', name: 'Example b', host: { name: 'Example Star', gaiaDr3Id: gaiaId },
  orbit: { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0, meanAnomalyAtEpochDeg: 0, epochJulianDate: 2451545 },
  physical: { radiusEarth: 1 }, ...overrides,
});

test('assemble Gaia et SIMBAD dans un système étoile unique lorsque Gaia DR3 est identique', () => {
  const result = buildStarSystems([gaia(), simbad()]);
  assert.equal(result.systems.length, 1);
  assert.equal(result.systems[0].star.name, 'Example Star');
  assert.equal(result.systems[0].identityStatus, 'verified-gaia-identity');
  assert.equal(result.systems[0].star.sourceRecords.length, 2);
});

test('propage les coordonnées stellaires à une époque julienne demandée', () => {
  const result = buildStarSystems([gaia()], { targetEpochJulianYear: 2026 });
  assert.equal(result.systems[0].star.coordinates.epoch, 2026);
  assert.ok(result.systems[0].star.propagation);
});

test('conserve les coordonnées si aucune époque cible n’est demandée', () => {
  const result = buildStarSystems([gaia()]);
  assert.equal(result.systems[0].star.coordinates.epoch, 2016);
  assert.equal(result.systems[0].star.propagation, null);
});

test('attache une exoplanète uniquement par identifiant Gaia DR3 vérifié', () => {
  const result = buildStarSystems([gaia(), planet()]);
  assert.equal(result.systems[0].planets.length, 1);
  assert.equal(result.statistics.attachedExoplanets, 1);
});

test('calcule l’orbite attachée si une date et une phase valides sont disponibles', () => {
  const result = buildStarSystems([gaia(), planet()], { targetJulianDate: 2451545 });
  assert.equal(result.systems[0].planets[0].orbitalState.status, 'calculated');
  assert.ok(Number.isFinite(result.systems[0].planets[0].orbitalState.position.position.x));
});

test('n’invente pas de phase orbitale et expose une orbite indisponible', () => {
  const noPhase = planet('nasa-exoplanet:no-phase');
  noPhase.orbit = { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0 };
  const result = buildStarSystems([gaia(), noPhase], { targetJulianDate: 2451545 });
  assert.equal(result.systems[0].planets[0].orbitalState.status, 'unavailable');
  assert.match(result.systems[0].planets[0].orbitalState.warnings[0], /periastronEpochJulianDate/);
});

test('conserve une correspondance d’hôte par nom comme candidate non automatique', () => {
  const host = planet('nasa-exoplanet:candidate', null);
  const result = buildStarSystems([simbad(), host]);
  assert.equal(result.systems[0].planets.length, 0);
  assert.equal(result.candidatePlanetHosts[0].status, 'candidate-host-name');
  assert.equal(result.candidatePlanetHosts[0].automaticAttachment, false);
});

test('garde séparées deux étoiles sans identifiant commun', () => {
  const result = buildStarSystems([gaia('123'), gaia('456', { id: 'gaia-dr3:456', sourceId: '456' })]);
  assert.equal(result.systems.length, 2);
});

test('expose les statistiques de composition des systèmes', () => {
  const result = buildStarSystems([gaia(), planet()]);
  assert.equal(result.statistics.inputRecords, 2);
  assert.equal(result.statistics.starSystems, 1);
  assert.equal(result.statistics.verifiedSystems, 1);
});

test('refuse une liste de données invalide', () => {
  assert.throws(() => buildStarSystems(null), /records doit être un tableau/);
});

test('le moteur délègue la recherche au service de catalogue et assemble le résultat', async () => {
  const catalogService = { resolveCrossReferences: async ({ name }) => ({ records: [gaia(), simbad(name)], queryCount: 2, retrievedAt: '2026-11-16T12:00:00Z' }) };
  const engine = new StarSystemEngine({ catalogService });
  const result = await engine.resolveByName('Example Star');
  assert.equal(result.systems.length, 1);
  assert.equal(result.catalog.queryCount, 2);
});

test('refuse un service de catalogue incompatible', () => {
  assert.throws(() => new StarSystemEngine({ catalogService: {} }), /resolveCrossReferences/);
  assert.throws(() => createStarSystemEngine({ catalogService: null }), /resolveCrossReferences/);
});

test('gère une planète dont l’hôte Gaia ne figure pas dans le jeu de données', () => {
  const result = buildStarSystems([gaia('456'), planet('planet-other', '123')]);
  assert.equal(result.systems[0].planets.length, 0);
  assert.equal(result.candidatePlanetHosts[0].status, 'unresolved-host');
});
