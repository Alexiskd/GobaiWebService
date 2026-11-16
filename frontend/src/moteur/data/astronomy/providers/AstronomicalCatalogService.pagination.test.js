import test from 'node:test';
import assert from 'node:assert/strict';
import { AstronomicalCatalogService } from './AstronomicalCatalogService.js';

test('searchGaiaCone utilise un curseur source_id sûr et une clé de cache distincte', async () => {
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(String(url));
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify({ metadata: [{ name: 'source_id' }, { name: 'ra' }, { name: 'dec' }, { name: 'parallax' }], data: [['123', 10, 5, 100]] }) };
  };
  const service = new AstronomicalCatalogService({ fetchImpl, maxRows: 500 });
  const first = await service.searchGaiaCone({ raDeg: 10, decDeg: 5, radiusDeg: 1, limit: 100 });
  const second = await service.searchGaiaCone({ raDeg: 10, decDeg: 5, radiusDeg: 1, limit: 100, sourceIdAfter: '123' });
  assert.equal(first.records.length, 1);
  assert.equal(second.records.length, 1);
  assert.match(new URL(urls[1]).searchParams.get('QUERY'), /source_id > 123/);
  await assert.rejects(service.searchGaiaCone({ raDeg: 10, decDeg: 5, radiusDeg: 1, sourceIdAfter: '1 OR 1=1' }), /Curseur Gaia/);
});
