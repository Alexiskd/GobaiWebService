// Tests du catalogue de la Documentation : tous les astres de l'application, groupés et cherchables.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_SATELLITES, MOON, PLANETS, SUN } from '../../../../Engine/SystemeEngine/data/astronomy/data/bodies.data.ts';
import { buildBodyCatalog, filterCatalog } from './bodyCatalog.js';

const catalog = buildBodyCatalog({ sun: SUN, moon: MOON, planets: PLANETS, satellites: ALL_SATELLITES });

test('une fiche par astre de l’application : Soleil, planètes, naines, Lune et satellites', () => {
  assert.equal(catalog.entries.length, 1 + PLANETS.length + 1 + ALL_SATELLITES.length);
  const names = new Set(catalog.entries.map((e) => e.name));
  for (const b of [SUN, MOON, ...PLANETS, ...ALL_SATELLITES]) assert.ok(names.has(b.name), b.name);
  assert.equal(new Set(catalog.entries.map((e) => e.id)).size, catalog.entries.length);
});

test('groupes dans l’ordre : étoile, planètes, naines, puis satellites par planète (Lune en tête de la Terre)', () => {
  const ids = catalog.groups.map((g) => g.id);
  assert.deepEqual(ids.slice(0, 3), ['etoile', 'planetes', 'naines']);
  const earth = catalog.groups.find((g) => g.id === 'satellites-earth');
  assert.equal(earth.entries[0].name, 'Lune');
  const jupiter = catalog.groups.find((g) => g.id === 'satellites-jupiter');
  const a = jupiter.entries.map((e) => ALL_SATELLITES.find((s) => s.name === e.name).aKm);
  assert.deepEqual(a, [...a].sort((x, y) => x - y));
});

test('chaque fiche a des caractéristiques et un résumé', () => {
  for (const e of catalog.entries) {
    assert.ok(e.facts.length >= 2, e.name);
    assert.ok(e.summary.length > 0, e.name);
  }
});

test('recherche sans accents et filtre par groupe', () => {
  const hits = filterCatalog(catalog, { query: 'ganymede' }).flatMap((g) => g.entries.map((e) => e.name));
  assert.deepEqual(hits, ['Ganymède']);
  const naines = filterCatalog(catalog, { group: 'naines' });
  assert.equal(naines.length, 1);
  assert.ok(naines[0].entries.every((e) => e.kind === 'naine'));
  assert.equal(filterCatalog(catalog, { query: 'zzz' }).length, 0);
});
