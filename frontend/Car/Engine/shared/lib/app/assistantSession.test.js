// Tests de la session de l'assistant : gardée dans le navigateur seulement, effacée à la déconnexion.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Stockage local simulé, avec d'anciennes clés du réglage « Clé Mistral » retiré.
const store = new Map([['gobai.mistral.key', 'ancienne'], ['gobai.mistral.model', 'mistral-small']]);
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const { PROVIDERS, clearSession, getSession, isVerified, saveSession, subscribe } = await import('./assistantSession.js');

test('les anciennes clés Mistral sont effacées au chargement', () => {
  assert.ok(!store.has('gobai.mistral.key'));
  assert.ok(!store.has('gobai.mistral.model'));
  assert.equal(getSession(), null);
});

test('connexion puis déconnexion : la clé est enregistrée, puis effacée', () => {
  let n = 0;
  const off = subscribe(() => { n += 1; });
  saveSession({ provider: 'mistral', key: '  cle-mistral-0123456789  ', model: 'mistral-large-latest' });
  assert.deepEqual(getSession(), { provider: 'mistral', key: 'cle-mistral-0123456789', model: 'mistral-large-latest' });
  assert.ok(isVerified());
  assert.ok(store.get('gobai.assistant.session').includes('cle-mistral'));
  clearSession();
  assert.equal(getSession(), null);
  assert.ok(!store.has('gobai.assistant.session'));
  assert.ok(!isVerified());
  assert.equal(n, 2);
  off();
});

test('deux fournisseurs, avec leur page de clés et de paiement', () => {
  assert.deepEqual(Object.keys(PROVIDERS), ['claude', 'mistral']);
  for (const p of Object.values(PROVIDERS)) {
    assert.match(p.keysUrl, /^https:\/\//);
    assert.match(p.billingUrl, /^https:\/\//);
  }
});
