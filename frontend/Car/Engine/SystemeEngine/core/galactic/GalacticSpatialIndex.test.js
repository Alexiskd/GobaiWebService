import test from 'node:test';
import assert from 'node:assert/strict';
import { GalacticSpatialIndex } from './GalacticSpatialIndex.js';

const point = (x, y = 0, z = 0) => ({ x, y, z });

test('indexe les systèmes dans des secteurs 3D et calcule des clés négatives correctement', () => {
  const index = new GalacticSpatialIndex({ sectorSizePc: 10 });
  index.upsert('sol', point(0, 0, 0));
  index.upsert('exemple', point(4.2, 0, 0));
  index.upsert('negative', point(-10.1, 0, 0));
  assert.equal(index.getStats().objects, 3);
  assert.equal(index.getStats().sectors, 2);
  assert.equal(index.getSectorKey(point(-0.1, 0, 0)), '-1:0:0');
});

test('la requête de rayon retourne les voisins triés par distance', () => {
  const index = new GalacticSpatialIndex();
  index.upsert('far', point(9, 0, 0));
  index.upsert('near-b', point(2, 0, 0));
  index.upsert('near-a', point(-1, 0, 0));
  index.upsert('outside', point(11, 0, 0));
  assert.deepEqual(index.queryRadius(point(0, 0, 0), 10).map((item) => item.id), ['near-a', 'near-b', 'far']);
});

test('nearest applique limite et distance maximale', () => {
  const index = new GalacticSpatialIndex();
  index.upsert('a', point(1)); index.upsert('b', point(2)); index.upsert('c', point(3));
  assert.deepEqual(index.nearest(point(0), { limit: 2 }).map((item) => item.id), ['a', 'b']);
  assert.deepEqual(index.nearest(point(0), { limit: 5, maxDistance: 2 }).map((item) => item.id), ['a', 'b']);
});

test('upsert déplace un objet et remove nettoie les secteurs vides', () => {
  const index = new GalacticSpatialIndex({ sectorSizePc: 5 });
  index.upsert('star', point(1));
  const oldSector = index.getSectorKey(point(1));
  const newSector = index.getSectorKey(point(11));
  index.upsert('star', point(11));
  assert.equal(index.querySector(oldSector).length, 0);
  assert.equal(index.querySector(newSector)[0].id, 'star');
  assert.equal(index.remove('star'), true);
  assert.equal(index.remove('star'), false);
  assert.equal(index.getStats().sectors, 0);
});

test('valide les paramètres et accepte un index vide', () => {
  assert.throws(() => new GalacticSpatialIndex({ sectorSizePc: 0 }), /sectorSizePc/);
  const index = new GalacticSpatialIndex();
  assert.deepEqual(index.queryRadius(point(0), 1), []);
  assert.throws(() => index.upsert('bad', { x: NaN, y: 0, z: 0 }), /position/);
});
