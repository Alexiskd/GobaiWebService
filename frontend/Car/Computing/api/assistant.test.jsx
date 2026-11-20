// Tests de l'API de l'assistant : la clé part dans l'en-tête, jamais dans l'adresse ; les refus arrivent typés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AssistantError, askAssistant, connectAssistant } from './assistant.jsx';

const KEY = 'sk-ant-test-0123456789abcdef';

function fakeServer(status, body) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

test('connexion : la clé est dans l’en-tête X-Assistant-Key, ni dans l’adresse ni dans le corps', async () => {
  const calls = fakeServer(201, { provider: 'claude', label: 'Claude', model: 'claude-fable-5-2' });
  const res = await connectAssistant('claude', KEY);
  assert.equal(res.model, 'claude-fable-5-2');
  const [{ url, init }] = calls;
  assert.match(url, /\/assistant\/session$/);
  assert.ok(!url.includes(KEY));
  assert.ok(!init.body.includes(KEY));
  assert.equal(init.headers['X-Assistant-Key'], KEY);
  assert.deepEqual(JSON.parse(init.body), { provider: 'claude' });
});

test('question : fournisseur, messages et inventaire dans le corps', async () => {
  const calls = fakeServer(201, { reply: 'Ganymède.', actions: [], provider: 'mistral', model: 'mistral-large-latest' });
  const res = await askAssistant('mistral', KEY, [{ role: 'user', content: 'Plus grande lune ?' }], []);
  assert.equal(res.reply, 'Ganymède.');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.provider, 'mistral');
  assert.equal(body.messages.length, 1);
});

test('facturation : code billing et page de paiement du fournisseur', async () => {
  fakeServer(402, { statusCode: 402, message: 'Pas de moyen de paiement.', code: 'billing', provider: 'mistral', billingUrl: 'https://admin.mistral.ai/organization/billing' });
  await assert.rejects(connectAssistant('mistral', KEY), (e) => e instanceof AssistantError && e.code === 'billing' && e.billingUrl.startsWith('https://admin.mistral.ai'));
});

test('clé refusée : code invalid_key, même sans code dans la réponse (statut 401)', async () => {
  fakeServer(401, { statusCode: 401, message: 'Clé refusée.' });
  await assert.rejects(askAssistant('claude', KEY, [], []), (e) => e.code === 'invalid_key' && e.message === 'Clé refusée.');
});

test('serveur injoignable : code network', async () => {
  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(connectAssistant('claude', KEY), (e) => e.code === 'network');
});
