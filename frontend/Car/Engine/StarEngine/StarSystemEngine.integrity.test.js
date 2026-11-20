import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStarSystems } from './StarSystemEngine.js';

const host = { id: 'gaia:42', kind: 'star', source: 'ESA Gaia DR3', sourceId: '42', coordinates: { frame: 'ICRS', epoch: 2016, raDeg: 12, decDeg: 4 }, identifiers: [{ catalog: 'Gaia DR3', value: '42' }] };
const planet = { id: 'nasa-exoplanet:test-b', kind: 'exoplanet', source: 'NASA Exoplanet Archive', name: 'Test b', host: { name: 'Test', gaiaDr3Id: '42', radiusSolar: 0.12 }, identifiers: [{ catalog: 'NASA Exoplanet Archive', value: 'Test b' }] };

test('retire les doublons exacts d’exoplanètes avant assemblage du système', () => {
  const result = buildStarSystems([host, planet, { ...planet, id: 'duplicate-import', physical: { radiusEarth: 1.3 } }]);
  assert.equal(result.statistics.attachedExoplanets, 1);
  assert.equal(result.statistics.exactDuplicateRecordsRemoved, 1);
  assert.equal(result.systems[0].planets[0].physical.radiusEarth, 1.3);
});

test('expose les rapprochements de coordonnées sans fusionner deux étoiles', () => {
  const other = { id: 'simbad:near', kind: 'astronomical-object', source: 'CDS SIMBAD', name: 'Nearby', coordinates: { frame: 'ICRS', raDeg: 12.0001, decDeg: 4 }, identifiers: [{ catalog: 'SIMBAD', value: 'Nearby' }] };
  const result = buildStarSystems([host, other]);
  assert.equal(result.systems.length, 2);
  assert.equal(result.catalogIntegrity.duplicateCandidates.length, 1);
});

test('expose un niveau de preuve documentaire sans déclarer une existence absolue', () => {
  const result = buildStarSystems([host, planet]);
  assert.equal(result.systems[0].star.existenceEvidence.status, 'catalogued');
  assert.equal(result.systems[0].planets[0].existenceEvidence.status, 'catalogued');
  assert.equal(result.systems[0].star.radiusSolar, 0.12);
  assert.match(result.systems[0].planets[0].existenceEvidence.reason, /table et les flags/);
});
