// Tests du partage et de la mémoire courte des lectures GET (moins de requêtes vers le serveur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { get } from './client.jsx';

// Remplace fetch par un faux serveur qui compte les appels ; `cacheControl` est l'en-tête renvoyé.
function fakeServer({ cacheControl = null, delayMs = 5, body = (url) => ({ url }) } = {}) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    await new Promise((r) => setTimeout(r, delayMs));
    const headers = { 'content-type': 'application/json' };
    if (cacheControl) headers['cache-control'] = cacheControl;
    return new Response(JSON.stringify(body(url)), { status: 200, headers });
  };
  return calls;
}

test('deux lectures simultanées identiques ne font qu’une requête', async () => {
  const calls = fakeServer();
  const [a, b] = await Promise.all([get('/t1/simultane'), get('/t1/simultane')]);
  assert.equal(calls.length, 1);
  assert.deepEqual(a, b);
});

test('une réponse récente est resservie sans requête', async () => {
  const calls = fakeServer();
  await get('/t2/recent');
  await get('/t2/recent');
  assert.equal(calls.length, 1);
});

test('une route no-store n’est jamais resservie de mémoire', async () => {
  const calls = fakeServer({ cacheControl: 'no-store' });
  await get('/t3/direct');
  await get('/t3/direct');
  assert.equal(calls.length, 2);
});

test('les descriptions de couches ne sont pas resservies (jeton qui expire)', async () => {
  const calls = fakeServer();
  await get('/tiles/layers/t4');
  await get('/tiles/layers/t4');
  assert.equal(calls.length, 2);
});

test('chaque appelant reçoit sa propre copie', async () => {
  fakeServer({ body: () => ({ items: [1] }) });
  const a = await get('/t5/copie');
  a.items.push(2);
  const b = await get('/t5/copie');
  assert.deepEqual(b.items, [1]);
});

test('l’annulation d’un appelant n’annule pas la lecture des autres', async () => {
  const calls = fakeServer({ delayMs: 30 });
  const ctrl = new AbortController();
  const first = get('/t6/partage', { signal: ctrl.signal });
  const second = get('/t6/partage');
  ctrl.abort();
  await assert.rejects(first, (e) => e.name === 'AbortError');
  assert.deepEqual(await second, { url: '/api/v1/t6/partage' });
  assert.equal(calls.length, 1);
});

test('les paramètres différents donnent des lectures distinctes', async () => {
  const calls = fakeServer();
  await get('/t7/requete', { query: { q: 'a' } });
  await get('/t7/requete', { query: { q: 'b' } });
  assert.equal(calls.length, 2);
});
