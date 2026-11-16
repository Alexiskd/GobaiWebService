// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions pures du blocage des API.
import { apiState, cleanHosts, fetchTarget, guardFetch, hostBlocked, hostsOfApi, toggleHosts, urlHost } from './apiBlock.jsx';
// Importe la liste des API de l'onglet « API ».
import { API_GROUPS } from '../../composante/components/hud/apiList.js';

// Test : hôtes d'une API.
test('une API peut avoir plusieurs hôtes', () => {
  // Deux hôtes séparés par « , ».
  assert.deepEqual(hostsOfApi({ host: 'astro.arcgis.com, tiles.arcgis.com' }), ['astro.arcgis.com', 'tiles.arcgis.com']);
// Fin du test.
});

// Test : correspondance d'hôte.
test('un hôte bloqué bloque ses sous-domaines, pas ses voisins', () => {
  // L'hôte et un sous-domaine.
  assert.ok(hostBlocked('s3.amazonaws.com', ['s3.amazonaws.com']));
  assert.ok(hostBlocked('a.tiles.openfreemap.org', ['tiles.openfreemap.org']));
  // Un voisin.
  assert.ok(!hostBlocked('nottiles.openfreemap.org', ['tiles.openfreemap.org']));
// Fin du test.
});

// Test : seules les adresses externes ont un hôte.
test('une adresse relative ou locale n’est jamais une API externe', () => {
  // Adresse externe.
  assert.equal(urlHost('https://Photon.komoot.io/api?q=x'), 'photon.komoot.io');
  // Adresses du site, blob et data.
  for (const url of ['/api/v1/tiles/layers', 'blob:https://x/y', 'data:image/png;base64,AA', '', undefined]) assert.equal(urlHost(url), null);
// Fin du test.
});

// Test : nettoyage et bascule.
test('la liste se nettoie et bascule sans doublon', () => {
  // Valeur corrompue du stockage.
  assert.deepEqual(cleanHosts('x'), []);
  // Doublons, casse et valeurs étrangères.
  assert.deepEqual(cleanHosts(['A.b', 'a.b', 3, 'c d']), ['a.b']);
  // Ajout puis retrait.
  assert.deepEqual(toggleHosts(['a.b'], ['a.b', 'c.d'], true), ['a.b', 'c.d']);
  assert.deepEqual(toggleHosts(['a.b', 'c.d'], ['a.b'], false), ['c.d']);
// Fin du test.
});

// Test : l'état le plus fort l'emporte.
test('état d’une API : serveur permanent, serveur, appareil, connectée', () => {
  // Une API.
  const api = { host: 'api.open-meteo.com' };
  // Chaque niveau.
  assert.equal(apiState(api), 'on');
  assert.equal(apiState(api, { local: ['api.open-meteo.com'] }), 'local');
  assert.equal(apiState(api, { local: ['api.open-meteo.com'], server: ['api.open-meteo.com'] }), 'server');
  assert.equal(apiState(api, { server: ['api.open-meteo.com'], permanent: ['open-meteo.com'] }), 'permanent');
// Fin du test.
});

// Test : le garde de fetch.
test('un appel vers une API déconnectée reçoit 503 sans toucher au réseau', async () => {
  // Compte les appels réels.
  let calls = 0;
  // Faux fetch.
  const inner = async () => { calls += 1; return new Response('ok'); };
  // Garde : seul photon.komoot.io est déconnecté.
  const guarded = guardFetch(inner, (url) => urlHost(url) === 'photon.komoot.io');
  // Appel bloqué, en texte, en URL et en Request.
  for (const input of ['https://photon.komoot.io/api', new URL('https://photon.komoot.io/api'), new Request('https://photon.komoot.io/api')]) {
    // Adresse lue.
    assert.equal(urlHost(fetchTarget(input)), 'photon.komoot.io');
    // Réponse 503.
    assert.equal((await guarded(input)).status, 503);
  // Fin de la boucle.
  }
  // Le réseau n'a pas été appelé.
  assert.equal(calls, 0);
  // Appel libre, et appel du site : ils passent.
  assert.equal(await (await guarded('https://data.geopf.fr/wmts')).text(), 'ok');
  assert.equal(await (await guarded('/api/v1/health')).text(), 'ok');
  assert.equal(calls, 2);
// Fin du test.
});

// Test : chaque API de l'onglet peut être déconnectée.
test('chaque API de la liste a au moins un hôte déconnectable', () => {
  // Parcourt toutes les API.
  for (const api of API_GROUPS.flatMap((g) => g.items)) {
    // Ses hôtes.
    const hosts = hostsOfApi(api);
    // Au moins un.
    assert.ok(hosts.length > 0, api.name);
    // Une fois ses hôtes bloqués, l'API est vue déconnectée et une adresse de son premier hôte est refusée.
    assert.equal(apiState(api, { local: hosts }), 'local', api.name);
    assert.ok(hostBlocked(urlHost(`https://${hosts[0]}/x`), hosts), api.name);
  // Fin du parcours.
  }
// Fin du test.
});
