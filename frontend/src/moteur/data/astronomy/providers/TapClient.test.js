import test from 'node:test';
import assert from 'node:assert/strict';
import { createTapUrl, executeTapQuery, parseTapRows } from './TapClient.js';

test('construit une URL TAP standard et encode la requête ADQL', () => {
  const url = new URL(createTapUrl('https://example.test/tap/sync', 'SELECT TOP 1 * FROM table'));
  assert.equal(url.searchParams.get('REQUEST'), 'doQuery');
  assert.equal(url.searchParams.get('LANG'), 'ADQL');
  assert.equal(url.searchParams.get('FORMAT'), 'json');
  assert.equal(url.searchParams.get('QUERY'), 'SELECT TOP 1 * FROM table');
});

test('permet les conventions query/format de NASA Exoplanet Archive', () => {
  const url = new URL(createTapUrl('https://example.test/TAP/sync', 'SELECT * FROM ps', {}, {
    requestParam: null, languageParam: null, formatParam: 'format', queryParam: 'query',
  }));
  assert.equal(url.searchParams.get('format'), 'json');
  assert.equal(url.searchParams.get('query'), 'SELECT * FROM ps');
  assert.equal(url.searchParams.has('REQUEST'), false);
});

test('convertit un TAP JSON metadata/data en objets', () => {
  assert.deepEqual(parseTapRows({ metadata: [{ name: 'source_id' }, { name: 'ra' }], data: [['42', 12.5]] }), [{ source_id: '42', ra: 12.5 }]);
});

test('accepte également un tableau JSON d’objets', () => {
  assert.deepEqual(parseTapRows([{ pl_name: 'Proxima Cen b' }]), [{ pl_name: 'Proxima Cen b' }]);
});

test('exécute une requête avec fetch injectable et conserve la provenance', async () => {
  let requested;
  const result = await executeTapQuery({
    provider: 'test', endpoint: 'https://example.test/tap', query: 'SELECT 1',
    fetchImpl: async (url, init) => {
      requested = { url, init };
      return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify([{ value: 1 }]) };
    },
  });
  assert.equal(new URL(requested.url).searchParams.get('QUERY'), 'SELECT 1');
  assert.equal(requested.init.credentials, 'omit');
  assert.deepEqual(result.rows, [{ value: 1 }]);
  assert.equal(result.provider, 'test');
  assert.ok(result.retrievedAt);
});
