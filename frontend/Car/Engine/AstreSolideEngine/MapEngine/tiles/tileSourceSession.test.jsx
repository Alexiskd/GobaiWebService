// Tests : une couche resélectionnée peu après ne redemande pas sa description au serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TileSource, freshSessionInfo, rememberSessionInfo } from './tileSource.jsx';

// Faux client de l'API qui compte les demandes de description.
function countingApi(info = { urlTemplate: '/api/v1/tiles/x/{z}/{x}/{y}.png', expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) {
  const api = { calls: 0, layer: async () => { api.calls++; return info; } };
  return api;
}

test('une couche resélectionnée aussitôt repart sans requête', async () => {
  const api = countingApi();
  const a = new TileSource({ api, layerId: 'session-mars' });
  await a.start();
  a.dispose();
  const b = new TileSource({ api, layerId: 'session-mars' });
  await b.start();
  assert.equal(api.calls, 1);
  assert.equal(b.status, 'ready');
  assert.equal(b.info.urlTemplate, '/api/v1/tiles/x/{z}/{x}/{y}.png');
  b.dispose();
});

test('au-delà de 30 s, la description est redemandée', () => {
  const now = Date.now();
  rememberSessionInfo('session-vieille', { urlTemplate: 'u' }, now - 31_000);
  assert.equal(freshSessionInfo('session-vieille', now), null);
  rememberSessionInfo('session-jeune', { urlTemplate: 'u' }, now - 5_000);
  assert.deepEqual(freshSessionInfo('session-jeune', now), { urlTemplate: 'u' });
});

test('un jeton qui expire dans moins d’une minute n’est pas resservi', () => {
  const now = Date.now();
  rememberSessionInfo('session-expire', { urlTemplate: 'u', expiresAt: new Date(now + 30_000).toISOString() }, now);
  assert.equal(freshSessionInfo('session-expire', now), null);
});

test('des couches différentes ne partagent pas leur description', async () => {
  const api = countingApi();
  const a = new TileSource({ api, layerId: 'session-lune' });
  await a.start();
  const b = new TileSource({ api, layerId: 'session-mercure' });
  await b.start();
  assert.equal(api.calls, 2);
  a.dispose(); b.dispose();
});
