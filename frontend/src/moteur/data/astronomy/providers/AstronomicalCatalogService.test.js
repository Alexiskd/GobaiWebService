import test from 'node:test';
import assert from 'node:assert/strict';
import { AstronomicalCatalogService } from './AstronomicalCatalogService.js';

function mockFetch(rows) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(rows) };
  };
  return { fetchImpl, calls };
}

test('interroge Gaia par source_id et normalise le résultat', async () => {
  const mock = mockFetch([{ source_id: '1234567890123456789', ra: 10, dec: 20, parallax: 5, ref_epoch: 2016 }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { gaia: 'https://mock.test/gaia' } });
  const result = await service.findGaiaSource('1234567890123456789');
  assert.equal(result.records[0].astrometry.parallaxMas, 5);
  assert.match(mock.calls[0], /gaiadr3\.gaia_source/);
});

test('rejette un identifiant Gaia non numérique avant le réseau', async () => {
  const mock = mockFetch([]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl });
  await assert.rejects(service.findGaiaSource('gaia-123'), /entier décimal/);
  assert.equal(mock.calls.length, 0);
});

test('SIMBAD essaie un miroir après échec du premier endpoint', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) throw new Error('offline');
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify([{ main_id: 'Sirius', ra: 101.28, dec: -16.71, otype: '*' }]) };
  };
  const service = new AstronomicalCatalogService({ fetchImpl, endpoints: { simbad: ['https://primary.test/tap', 'https://mirror.test/tap'] } });
  const result = await service.resolveSimbadName('Sirius');
  assert.equal(result.records[0].name, 'Sirius');
  assert.equal(calls.length, 2);
});

test('interroge NASA avec query/format minuscules et normalise l’orbite', async () => {
  const mock = mockFetch([{ pl_name: 'Proxima Cen b', hostname: 'Proxima Cen', pl_orbper: 11.186, pl_orbsmax: 0.0485 }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { exoplanet: 'https://mock.test/TAP/sync' } });
  const result = await service.findExoplanetsByHost('Proxima Cen');
  const url = new URL(mock.calls[0]);
  assert.equal(url.searchParams.get('format'), 'json');
  assert.match(url.searchParams.get('query'), /FROM pscomppars/);
  assert.match(url.searchParams.get('query'), /pl_orblper/);
  assert.match(url.searchParams.get('query'), /pl_orbtper/);
  assert.match(url.searchParams.get('query'), /st_rad/);
  assert.match(url.searchParams.get('query'), /pl_radj/);
  assert.doesNotMatch(url.searchParams.get('query'), /pl_orblnode/);
  assert.equal(result.records[0].orbit.periodDays, 11.186);
});

test('met en cache les requêtes identiques et expose les statistiques', async () => {
  const mock = mockFetch([{ pl_name: 'Proxima Cen b', hostname: 'Proxima Cen' }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { exoplanet: 'https://mock.test/TAP/sync' } });
  await service.findExoplanetsByHost('Proxima Cen');
  const cached = await service.findExoplanetsByHost('Proxima Cen');
  assert.equal(cached.cache, 'hit');
  assert.equal(mock.calls.length, 1);
  assert.equal(service.getCacheStats().entries, 1);
});

test('collecte Gaia, SIMBAD et NASA pour une résolution croisée sans fusion implicite', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    calls.push(parsed);
    const query = parsed.searchParams.get('QUERY') || parsed.searchParams.get('query') || '';
    let rows = [];
    if (query.includes('gaiadr3.gaia_source')) rows = [{ source_id: '123', ra: 10, dec: 20, ref_epoch: 2016 }];
    else if (query.includes('FROM basic')) rows = [{ main_id: 'Example Star', ra: 10, dec: 20, otype: '*' }];
    else if (query.includes('FROM pscomppars')) rows = [{ pl_name: 'Example b', hostname: 'Example Star', gaia_dr3_id: '123' }];
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(rows) };
  };
  const service = new AstronomicalCatalogService({ fetchImpl, endpoints: { gaia: 'https://mock.test/gaia', simbad: ['https://mock.test/simbad'], exoplanet: 'https://mock.test/nasa' } });
  const result = await service.resolveCrossReferences({ name: 'Example Star', gaiaSourceId: '123' });
  assert.equal(result.records.length, 3);
  assert.equal(result.queryCount, 3);
  assert.equal(calls.length, 3);
});

test('résolution croisée sans requête optionnelle retourne un jeu vide', async () => {
  const service = new AstronomicalCatalogService({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  const result = await service.resolveCrossReferences({ includeExoplanets: false });
  assert.deepEqual(result.records, []);
  assert.equal(result.queryCount, 0);
});

test('recherche les systèmes exoplanétaires dans un cône ICRS NASA', async () => {
  const mock = mockFetch([{ pl_name: 'Demo b', hostname: 'Demo', gaia_dr3_id: '123', ra: 10, dec: 20 }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { exoplanet: 'https://mock.test/TAP/sync' } });
  const result = await service.searchExoplanetSystemsCone({ raDeg: 10, decDeg: 20, radiusDeg: 2, limit: 10 });
  const query = new URL(mock.calls[0]).searchParams.get('query');
  assert.match(query, /CONTAINS\(POINT\('ICRS'/);
  assert.match(query, /sy_pnum > 0/);
  assert.equal(result.records[0].host.gaiaDr3Id, '123');
});

test('recherche SIMBAD dans un cône spatial ICRS', async () => {
  const mock = mockFetch([{ main_id: 'Demo Star', ra: 10, dec: 20, otype: '*' }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { simbad: ['https://mock.test/simbad'] } });
  const result = await service.searchSimbadCone({ raDeg: 10, decDeg: 20, radiusDeg: 0.01 });
  const query = new URL(mock.calls[0]).searchParams.get('QUERY');
  assert.match(query, /FROM basic AS b/);
  assert.equal(result.records[0].name, 'Demo Star');
});

test('recherche les exoplanètes par identifiant Gaia exact', async () => {
  const mock = mockFetch([{ pl_name: 'Demo b', hostname: 'Demo', gaia_dr3_id: '987654' }]);
  const service = new AstronomicalCatalogService({ fetchImpl: mock.fetchImpl, endpoints: { exoplanet: 'https://mock.test/TAP/sync' } });
  const result = await service.findExoplanetsByGaiaHostId('987654');
  assert.match(new URL(mock.calls[0]).searchParams.get('query'), /gaia_dr3_id=987654/);
  assert.equal(result.records[0].host.gaiaDr3Id, '987654');
});

test('refuse les appels navigateur directs SIMBAD/NASA quand aucun proxy de production n’est configuré', async () => {
  const service = new AstronomicalCatalogService({ fetchImpl: async () => { throw new Error('aucun appel direct attendu'); } });
  await assert.rejects(service.resolveSimbadName('Proxima Centauri'), /VITE_ASTRONOMY_PROXY_URL/);
  await assert.rejects(service.findExoplanetsByHost('Proxima Centauri'), /VITE_ASTRONOMY_PROXY_URL/);
});
