// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { ADDRESS_VIEW_M, fold, placeResultType, resultIcon } from './search';

// Premier test : la clé de recherche.
test('clé de recherche : sans accents, en minuscules', () => {
  // « Île-de-France » devient « ile-de-france ».
  assert.equal(fold('Île-de-France'), 'ile-de-france');
// Fin du test.
});

// Deuxième test : les pictogrammes.
test('vignette : une par type de résultat, repli sur le lieu', () => {
  // Les six types.
  const types = ['body', 'city', 'world', 'place', 'address', 'gps'];
  // Chacun a un pictogramme.
  for (const type of types) assert.ok(resultIcon(type).length > 0);
  // Adresse et lieu diffèrent.
  assert.notEqual(resultIcon('address'), resultIcon('place'));
  // Astre et ville diffèrent.
  assert.notEqual(resultIcon('body'), resultIcon('city'));
  // Un type inconnu prend celui d'un lieu.
  assert.equal(resultIcon('inconnu'), resultIcon('place'));
// Fin du test.
});

// Troisième test : le type d'un lieu.
test('lieu de la recherche mondiale : adresse ou localité', () => {
  // Une adresse : « address ».
  assert.equal(placeResultType({ name: '12 Rue de la Paix', kind: 'address' }), 'address');
  // Une localité : « place ».
  assert.equal(placeResultType({ name: 'Paris' }), 'place');
  // Rien : « place ».
  assert.equal(placeResultType(null), 'place');
  // La hauteur de vue est entre 100 et 1 000 m.
  assert.ok(ADDRESS_VIEW_M >= 100 && ADDRESS_VIEW_M <= 1000);
// Fin du test.
});
