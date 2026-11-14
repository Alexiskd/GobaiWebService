// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la liste des API par groupe et la fonction qui les compte.
import { API_GROUPS, countApis } from './apiList.js';

// Toutes les API, tous groupes confondus.
const items = API_GROUPS.flatMap((g) => g.items);

// Test : chaque API est complète.
test('chaque API a un nom, une adresse et un usage', () => {
  // Parcourt les API.
  for (const api of items) {
    // Elle a un nom et un usage.
    assert.ok(api.name && api.use, api.name);
    // Son adresse est un nom d'hôte, ou plusieurs séparés par une virgule et une espace.
    assert.match(api.host, /^[a-z0-9.-]+(, [a-z0-9.-]+)*$/, api.name);
  // Fin du parcours.
  }
// Fin du test.
});

// Test : pas de doublon, et le total est juste.
test('aucune API en double, et le total correspond', () => {
  // Il y a autant de noms distincts que d'API.
  assert.equal(new Set(items.map((api) => api.name)).size, items.length);
  // countApis renvoie le même total.
  assert.equal(countApis(), items.length);
// Fin du test.
});
