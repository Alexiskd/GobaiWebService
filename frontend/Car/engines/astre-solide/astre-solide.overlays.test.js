// Tests des paramètres de l'astre redessinés sur le globe CesiumJS (node --test via tsx).
import test from 'node:test';
import assert from 'node:assert/strict';
import { OVERLAYS, fadeRadii, moonPlaces, splitLines, topCities } from './astre-solide.overlays.js';

test('lignes : coupées au saut de l’antiméridien, morceaux d’au moins deux points', () => {
  // Une ligne qui passe de 179° à −179° : deux morceaux.
  assert.deepEqual(splitLines([[170, 0, 179, 1, -179, 1, -170, 2]]), [[170, 0, 179, 1], [-179, 1, -170, 2]]);
  // Un point seul : ignoré ; liste absente : rien.
  assert.deepEqual(splitLines([[10, 10]]), []);
  assert.deepEqual(splitLines(null), []);
});

test('villes : les plus peuplées d’abord, bornées, capitales visibles plus loin', () => {
  const cities = [{ name: 'B', lon: 1, lat: 1, pop: 10 }, { name: 'A', native: 'Á', lon: 2, lat: 2, pop: 50 }, { name: 'X', lon: NaN, lat: 0, pop: 99 }];
  const top = topCities(cities);
  // Ville sans coordonnées écartée ; nom local gardé ; ordre par population.
  assert.deepEqual(top.map((c) => c.text), ['Á', 'B']);
  // Borne.
  assert.equal(topCities(Array.from({ length: 10 }, (_, i) => ({ name: `${i}`, lon: 0, lat: 0, pop: i })), 3).length, 3);
  // Capitale au 300e rang : rang ramené à 100 (visible à moyenne distance).
  const many = Array.from({ length: 300 }, (_, i) => ({ name: `${i}`, lon: 0, lat: 0, pop: 1000 - i, capital: i === 299 }));
  assert.equal(topCities(many).at(-1).rank, 100);
});

test('distance d’effacement des noms selon leur rang', () => {
  assert.equal(fadeRadii(0), 0.6); assert.equal(fadeRadii(50), 0.25); assert.equal(fadeRadii(500), 0.1);
});

test('lieux de la Lune : seulement les types choisis', () => {
  const f = [{ name: 'Apollo 11', type: 'landing', lon: 23, lat: 0.6, tier: 0 }, { name: 'Tycho', type: 'crater', lon: -11, lat: -43, tier: 1 }];
  assert.deepEqual(moonPlaces(new Set(['landing']), f).map((p) => p.text), ['Apollo 11']);
  assert.equal(moonPlaces([], f).length, 0);
});

test('table : chaque paramètre lit l’état de l’app et ses données', () => {
  const byId = Object.fromEntries(OVERLAYS.map((d) => [d.id, d]));
  // Frontières : suivent l'interrupteur et les données reçues.
  assert.equal(byId.borders.want({ bordersOn: true }), true);
  assert.deepEqual(byId.borders.data({ borderData: { lines: [[0, 0, 1, 1]] } }), [[0, 0, 1, 1]]);
  // Littoraux : pas quand les rues donnent les leurs.
  assert.equal(byId.coasts.want({ coastsOn: true, coastsFromTiles: true }), false);
  // Villes et lieux de la Lune : repères HTML (pas en double en superposition).
  assert.equal(byId.cities.html, true); assert.equal(byId['moon-places'].html, true);
  // Volcans : liste du calque three.js.
  assert.deepEqual(byId.volcanoes.data({ volcanoes: { list: [{ name: 'Etna', lon: 15, lat: 37.7 }] } }), [{ text: 'Etna', lon: 15, lat: 37.7, rank: 0 }]);
  // Rues : seulement quand le calque des rues est posé sur la Terre.
  assert.equal(byId.roads.want({ tiledById: { earth: { tiles: { overlay: { id: 'earth-roads' } } } } }), true);
  assert.equal(byId.roads.want({}), false);
});
