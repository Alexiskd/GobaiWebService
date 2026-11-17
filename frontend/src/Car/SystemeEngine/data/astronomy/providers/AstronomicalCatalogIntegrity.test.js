import test from 'node:test';
import assert from 'node:assert/strict';
import { auditAstronomicalCatalog, classifyAstronomicalExistence } from './AstronomicalCatalogIntegrity.js';

const gaia = (id, ra = 10, source = 'ESA Gaia DR3') => ({ id: `${source}:${id}`, kind: 'star', source, sourceId: String(id), name: null, coordinates: { raDeg: ra, decDeg: 20 }, identifiers: [{ catalog: 'Gaia DR3', value: String(id) }] });

test('fusionne uniquement les doublons portant le même identifiant Gaia DR3 exact', () => {
  const result = auditAstronomicalCatalog([gaia('123'), { ...gaia('123', 10.0000001), id: 'import:123', source: 'import' }]);
  assert.equal(result.canonicalRecords.length, 1);
  assert.equal(result.statistics.exactDuplicateRecordsRemoved, 1);
  assert.equal(result.duplicateGroups[0].catalog, 'Gaia DR3');
});

test('signale les coordonnées contradictoires pour un identifiant identique', () => {
  const result = auditAstronomicalCatalog([gaia('123', 10), gaia('123', 11)]);
  assert.equal(result.identityConflicts.length, 1);
});

test('proximité angulaire = candidat et jamais fusion automatique', () => {
  const result = auditAstronomicalCatalog([gaia('123'), { id: 'other', kind: 'star', source: 'other catalog', coordinates: { raDeg: 10.0001, decDeg: 20 } }]);
  assert.equal(result.canonicalRecords.length, 2);
  assert.equal(result.duplicateCandidates.length, 1);
  assert.equal(result.duplicateCandidates[0].automaticMerge, false);
});

test('dédoublonne un même nom de planète dans NASA Exoplanet Archive', () => {
  const p = { id: 'nasa-exoplanet:planet-b', kind: 'exoplanet', source: 'NASA Exoplanet Archive', name: 'Planet b', identifiers: [{ catalog: 'NASA Exoplanet Archive', value: 'Planet b' }] };
  const result = auditAstronomicalCatalog([p, { ...p, id: 'import-copy', physical: { radiusEarth: 1 } }]);
  assert.equal(result.canonicalRecords.length, 1);
  assert.equal(result.canonicalRecords[0].physical.radiusEarth, 1);
});

test('ne présente pas une absence de provenance comme une preuve d’inexistence', () => {
  assert.equal(classifyAstronomicalExistence({ id: 'x' }).status, 'unverified');
  assert.equal(classifyAstronomicalExistence({ source: 'ESA Gaia DR3' }).status, 'catalogued');
});

test('ne signale pas comme doublons deux sources liées par le même Gaia DR3', () => {
  const gaiaRecord = gaia('987');
  const simbadRecord = { id: 'simbad:alpha', kind: 'star', source: 'CDS SIMBAD', name: 'Alpha', coordinates: { raDeg: 10, decDeg: 20 }, identifiers: [{ catalog: 'SIMBAD', value: 'Alpha' }, { catalog: 'Gaia DR3', value: '987' }] };
  const result = auditAstronomicalCatalog([gaiaRecord, simbadRecord]);
  assert.equal(result.duplicateCandidates.length, 0);
});

test('détecte les candidats proches de la frontière RA 0°/360°', () => {
  const result = auditAstronomicalCatalog([
    { id: 'a', kind: 'star', source: 'catalogue A', coordinates: { raDeg: 359.9999, decDeg: 0 } },
    { id: 'b', kind: 'star', source: 'catalogue B', coordinates: { raDeg: 0.0001, decDeg: 0 } },
  ]);
  assert.equal(result.duplicateCandidates.length, 1);
  assert.ok(result.duplicateCandidates[0].separationArcsec < 1);
});

test('reconnaît les éléments orbitaux JPL comme preuve de provenance cataloguée', () => {
  const evidence = classifyAstronomicalExistence({ id: 'puck', kepler: { sourceReference: 'JPL URA182' } });
  assert.equal(evidence.status, 'catalogued');
  assert.equal(evidence.label, 'Éléments JPL');
});
