// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la table des familles et les fonctions testées.
import { BODY_KINDS, bodiesWithLayers, defaultHiddenBodies, defaultVisibility, isKindHidden, planetKind, shownByDefault } from './bodyKinds';

// Test : la famille de chaque planète.
test('famille des planètes : solides, gazeuses, naines', () => {
  // Mercure, Vénus, la Terre et Mars : famille « solid ».
  for (const name of ['Mercure', 'Vénus', 'Terre', 'Mars']) assert.equal(planetKind({ name }), 'solid', name);
  // Jupiter, Saturne, Uranus et Neptune : famille « gas ».
  for (const name of ['Jupiter', 'Saturne', 'Uranus', 'Neptune']) assert.equal(planetKind({ name }), 'gas', name);
  // Pluton, marquée naine : famille « dwarf ».
  assert.equal(planetKind({ name: 'Pluton', dwarf: true }), 'dwarf');
  // Les identifiants de la table, dans l'ordre : solid, gas, dwarf, satellite.
  assert.deepEqual(BODY_KINDS.map((k) => k.id), ['solid', 'gas', 'dwarf', 'satellite']);
// Fin du test.
});

// Test : le masquage par famille.
test('masquage : un satellite suit sa planète et la famille des satellites ; le Soleil reste toujours', () => {
  // Famille « gas » masquée, astre de cette famille : masqué.
  assert.equal(isKindHidden(new Set(['gas']), 'gas'), true);
  // Famille « gas » masquée, satellite d'une planète de cette famille : masqué.
  assert.equal(isKindHidden(new Set(['gas']), 'gas', true), true);   // Io avec Jupiter
  // Famille « gas » masquée, satellite d'une planète solide : affiché.
  assert.equal(isKindHidden(new Set(['gas']), 'solid', true), false); // la Lune reste
  // Famille « satellite » masquée, satellite d'une planète solide : masqué.
  assert.equal(isKindHidden(new Set(['satellite']), 'solid', true), true);
  // Famille « satellite » masquée, planète solide : affichée.
  assert.equal(isKindHidden(new Set(['satellite']), 'solid'), false); // la Terre reste
  // Toutes les familles masquées, astre sans famille : affiché.
  assert.equal(isKindHidden(new Set(['solid', 'gas', 'dwarf', 'satellite']), null), false);
// Fin du test.
});

// Liste de navigation d'essai (début).
const NAV = [
  // Le Soleil, indice 0.
  { index: 0, name: 'Soleil' },
  // La Terre, indice 3.
  { index: 3, id: 'earth', name: 'Terre' },
  // La Lune, indice 10, satellite de l'indice 3.
  { index: 10, id: 'moon', name: 'Lune', satellite: true, parent: 3 },
  // Mars, indice 4.
  { index: 4, id: 'mars', name: 'Mars' },
  // Phobos, indice 11, satellite de l'indice 4.
  { index: 11, id: 'phobos', name: 'Phobos', satellite: true, parent: 4 },
  // Deimos, indice 12, satellite de l'indice 4.
  { index: 12, id: 'deimos', name: 'Deimos', satellite: true, parent: 4 },
  // Jupiter, indice 5.
  { index: 5, id: 'jupiter', name: 'Jupiter' },
  // Io, indice 13, satellite de l'indice 5.
  { index: 13, id: 'io', name: 'Io', satellite: true, parent: 5 },
  // Pluton, indice 9.
  { index: 9, id: 'pluto', name: 'Pluton' },
// Fin de la liste.
];
// Couches : Terre (sans `body`), Lune, Mars, Phobos, Io — ni Deimos, ni Jupiter, ni Pluton.
// Couches d'essai : une sans astre, puis une pour la Lune, Mars, Phobos et Io.
const LAYERS = [{ id: 'earth-hd' }, { id: 'm1', body: 'moon' }, { id: 'm2', body: 'mars' }, { id: 'p1', body: 'phobos' }, { id: 'i1', body: 'io' }];

// Test : les astres affichés par défaut.
test('affichage par défaut : un seul ET, seules les couches comptent', () => {
  // Ensemble des astres qui ont une couche.
  const withLayers = bodiesWithLayers(LAYERS);
  // Trié : earth, io, mars, moon, phobos.
  assert.deepEqual([...withLayers].sort(), ['earth', 'io', 'mars', 'moon', 'phobos']);
  // by : retrouve un astre de la liste par son nom.
  const by = (name) => NAV.find((b) => b.name === name);
  // Le Soleil : affiché.
  assert.equal(shownByDefault(by('Soleil'), withLayers), true);            // toujours
  // La Terre : affichée.
  assert.equal(shownByDefault(by('Terre'), withLayers), true);             // a une couche
  // Pluton : pas affiché.
  assert.equal(shownByDefault(by('Pluton'), withLayers), false);           // aucune couche
  // Phobos, avec Mars pour planète : affiché.
  assert.equal(shownByDefault(by('Phobos'), withLayers, by('Mars')), true); // couche ET planète avec couche
  // Deimos, avec Mars pour planète : pas affiché.
  assert.equal(shownByDefault(by('Deimos'), withLayers, by('Mars')), false); // pas de couche
  // Io, avec Jupiter pour planète : pas affiché.
  assert.equal(shownByDefault(by('Io'), withLayers, by('Jupiter')), false);  // couche, mais planète sans couche
  // Indices masqués par défaut à l'adresse « / » : 12, 5, 13 et 9.
  assert.deepEqual(defaultHiddenBodies(NAV, LAYERS, '/'), [12, 5, 13, 9]);  // Deimos, Jupiter, Io, Pluton
// Fin du test.
});

// Test : l'effet de l'adresse d'arrivée.
test('affichage par défaut : l’astre de l’adresse d’arrivée et sa planète restent affichés', () => {
  // Adresse « /jupiter » : Jupiter n'est plus masqué, restent 12, 13 et 9.
  assert.deepEqual(defaultHiddenBodies(NAV, LAYERS, '/jupiter'), [12, 13, 9]);
  // Adresse « /io » : Io et Jupiter ne sont plus masqués, restent 12 et 9.
  assert.deepEqual(defaultHiddenBodies(NAV, LAYERS, '/io'), [12, 9]);
  // Adresse « /Deimos/ » : Deimos n'est plus masqué, restent 5, 13 et 9.
  assert.deepEqual(defaultHiddenBodies(NAV, LAYERS, '/Deimos/'), [5, 13, 9]);
  // Adresse « /galerie » : aucun astre reconnu, même liste qu'à « / ».
  assert.deepEqual(defaultHiddenBodies(NAV, LAYERS, '/galerie'), [12, 5, 13, 9]);
// Fin du test.
});

// Test : l'affichage avant de connaître les couches.
test('affichage au premier instant : tout est affiché en attendant la liste des couches', () => {
  // Affichage par défaut.
  const d = defaultVisibility();
  // Les quatre familles sont affichées.
  assert.deepEqual(d.kinds, { solid: true, gas: true, dwarf: true, satellite: true });
  // Aucun astre masqué.
  assert.deepEqual(d.hiddenBodies, []);
// Fin du test.
});

// Test : la prise en compte du nombre réel de fonds.
test('affichage par défaut : pour les satellites et les géantes, le nombre réel de fonds fait foi', () => {
  // La liste générale donne une entrée à Jupiter, Io et Deimos, mais seul Io a réellement un fond.
  // Couches d'essai complétées par une entrée pour Jupiter et une pour Deimos.
  const layers = [...LAYERS, { id: 'j0', body: 'jupiter' }, { id: 'd0', body: 'deimos' }];
  // État d'essai : 0 fond pour Jupiter et Deimos, 3 pour Io, 1 pour Phobos.
  const status = [{ id: 'jupiter', layers: 0 }, { id: 'io', layers: 3 }, { id: 'deimos', layers: 0 }, { id: 'phobos', layers: 1 }];
  // Ensemble des astres qui ont une couche, d'après les couches et cet état.
  const withLayers = bodiesWithLayers(layers, status);
  // Jupiter n'en fait pas partie.
  assert.equal(withLayers.has('jupiter'), false);
  // Deimos n'en fait pas partie.
  assert.equal(withLayers.has('deimos'), false);
  // Io en fait partie.
  assert.equal(withLayers.has('io'), true);
  // Mars en fait partie.
  assert.equal(withLayers.has('mars'), true); // absent de l'état : la liste générale suffit
  // Sans état, la liste générale seule les croit tous cartographiés.
  // Sans l'état : seul l'indice 9 est masqué.
  assert.deepEqual(defaultHiddenBodies(NAV, layers, '/'), [9]);
  // Avec l'état : Deimos et Jupiter sans fond, donc Io (satellite de Jupiter) aussi, et Pluton.
  // Avec l'état : 12, 5, 13 et 9 sont masqués.
  assert.deepEqual(defaultHiddenBodies(NAV, layers, '/', status), [12, 5, 13, 9]);
// Fin du test.
});
