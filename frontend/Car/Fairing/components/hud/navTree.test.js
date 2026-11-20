// Tests de l'arborescence de la navigation : Soleil → Planètes / Planètes naines → planète → satellites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { navTree, pathTo } from './navTree.js';

const bodies = [
  { index: 0, name: 'Soleil' },
  { index: 3, name: 'Terre', kind: 'solid' },
  { index: 14, name: 'Lune', satellite: true, parent: 3 },
  { index: 5, name: 'Cérès', kind: 'dwarf' },
  { index: 6, name: 'Jupiter', kind: 'gas' },
  { index: 16, name: 'Io', satellite: true, parent: 6 },
  { index: 17, name: 'Europe', satellite: true, parent: 6 },
  { index: 10, name: 'Pluton', kind: 'dwarf' },
  { index: 30, name: 'Charon', satellite: true, parent: 10 },
];

test('Soleil, puis Planètes et Planètes naines, puis les satellites de chaque planète', () => {
  const t = navTree(bodies);
  assert.equal(t.sun.name, 'Soleil');
  assert.deepEqual(t.branches.map((b) => b.name), ['Planètes', 'Planètes naines']);
  assert.deepEqual(t.branches[0].planets.map((p) => p.name), ['Terre', 'Jupiter']);
  assert.deepEqual(t.branches[1].planets.map((p) => p.name), ['Cérès', 'Pluton']);
  assert.deepEqual(t.branches[0].planets[1].moons.map((m) => m.name), ['Io', 'Europe']);
  assert.deepEqual(t.branches[1].planets[1].moons.map((m) => m.name), ['Charon']);
});

test('chemin de l’astre visé, branche vide retirée, Soleil masqué', () => {
  const t = navTree(bodies);
  assert.deepEqual(pathTo(t, 17), { branch: 'planetes', planet: 6 });
  assert.deepEqual(pathTo(t, 10), { branch: 'naines', planet: 10 });
  assert.deepEqual(pathTo(t, 0), { branch: null, planet: null });
  const noDwarf = navTree(bodies.filter((b) => b.kind !== 'dwarf' && b.parent !== 10));
  assert.deepEqual(noDwarf.branches.map((b) => b.id), ['planetes']);
  assert.equal(navTree(bodies.slice(1)).sun, null);
});
