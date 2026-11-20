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

// Vérification contre le code : un service retiré du projet ne doit pas revenir dans la liste, et ceux réellement
// appelés doivent y figurer.
test('la liste suit le code : plus de JPL Horizons ni d’ipify, Mistral déclaré', () => {
  const hosts = items.flatMap((api) => api.host.split(', '));
  assert.ok(!hosts.includes('ssd.jpl.nasa.gov'));
  // Le verrou d'accès par adresse IP est retiré : ipify n'est plus appelé.
  assert.ok(!hosts.includes('api.ipify.org'));
  for (const h of ['api.mistral.ai', 'svs.gsfc.nasa.gov', 'gea.esac.esa.int']) assert.ok(hosts.includes(h), h);
  assert.equal(new Set(hosts).size, hosts.length);
});

// Plus aucun service n'est requis à l'ouverture depuis le retrait du verrou d'accès.
test('aucun service requis, Mistral dépend d’une clé', () => {
  assert.ok(items.every((api) => !api.requis));
  assert.equal(items.find((api) => api.host === 'api.mistral.ai').key, true);
  for (const api of items) assert.ok(['api', 'tiles', 'static'].includes(api.kind), api.name);
});
