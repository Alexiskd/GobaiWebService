import test from 'node:test';
import assert from 'node:assert/strict';
import { AstronomicalCatalogService } from './providers/AstronomicalCatalogService.js';
import { AstronomicalSystemExplorer } from './AstronomicalSystemExplorer.js';

function mockFetch(url) {
  const parsed = new URL(String(url));
  const query = parsed.searchParams.get('QUERY') || parsed.searchParams.get('query') || '';
  let rows = [];
  if (query.includes('gaiadr3.gaia_source')) rows = [{ source_id: '123456', ra: 217.4, dec: -62.6, parallax: 10, ref_epoch: 2016 }];
  else if (query.includes('FROM pscomppars')) rows = [{ pl_name: 'Demo b', hostname: 'Demo Star', gaia_dr3_id: '123456', pl_orbper: 10, pl_orbsmax: 0.1, pl_orbeccen: 0.1, pl_orbincl: 2, sy_pnum: 1, ra: 217.4, dec: -62.6 }];
  else if (query.includes('FROM basic')) rows = [{ main_id: 'Demo Star', ra: 217.4, dec: -62.6, otype: '*' }];
  return Promise.resolve({ ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(rows) });
}

test('les services Gaia, SIMBAD et NASA sont combinés en système stellaire visualisable', async () => {
  const catalog = new AstronomicalCatalogService({ fetchImpl: mockFetch, endpoints: { gaia: 'https://mock.test/gaia', simbad: ['https://mock.test/simbad'], exoplanet: 'https://mock.test/nasa' } });
  const explorer = new AstronomicalSystemExplorer({ catalogService: catalog });
  const result = await explorer.searchSystemsInCone({ raDeg: 217.4, decDeg: -62.6, radiusDeg: 1, limit: 20 });
  assert.equal(result.systems.length, 1);
  assert.equal(result.systems[0].planets.length, 1);
  assert.equal(result.systems[0].star.name, 'Demo Star');
  assert.equal(result.scenes.length, 1);
  assert.equal(result.scenes[0].planets.length, 1);
});

test('le service catalogue permet une recherche par identifiant Gaia exact', async () => {
  const catalog = new AstronomicalCatalogService({ fetchImpl: mockFetch, endpoints: { gaia: 'https://mock.test/gaia', simbad: ['https://mock.test/simbad'], exoplanet: 'https://mock.test/nasa' } });
  const result = await catalog.findExoplanetsByGaiaHostId('123456');
  assert.equal(result.records[0].host.gaiaDr3Id, '123456');
});

test('résout un nom SIMBAD puis découvre ses planètes via le cône NASA et Gaia', async () => {
  const fetchImpl = async (url) => {
    const parsed = new URL(String(url));
    const query = parsed.searchParams.get('QUERY') || parsed.searchParams.get('query') || '';
    let rows = [];
    if (query.includes('FROM basic')) rows = [{ main_id: 'Proxima Centauri', ra: 217.4, dec: -62.6, otype: '*' }];
    else if (query.includes('FROM pscomppars') && query.includes('CONTAINS')) rows = [{ pl_name: 'Proxima Cen b', hostname: 'Proxima Cen', gaia_dr3_id: '123456', pl_orbper: 11.2, pl_orbsmax: 0.05, pl_orbeccen: 0.1, ra: 217.4, dec: -62.6 }];
    else if (query.includes('gaiadr3.gaia_source')) rows = [{ source_id: '123456', ra: 217.4, dec: -62.6, parallax: 768, ref_epoch: 2016 }];
    return { ok: true, headers: { get: () => 'application/json' }, text: async () => JSON.stringify(rows) };
  };
  const catalog = new AstronomicalCatalogService({ fetchImpl, endpoints: { gaia: 'https://mock.test/gaia', simbad: ['https://mock.test/simbad'], exoplanet: 'https://mock.test/nasa' } });
  const explorer = new AstronomicalSystemExplorer({ catalogService: catalog });
  const result = await explorer.resolveByName('Proxima Centauri', { targetJulianDate: 2461350.5 });
  assert.equal(result.systems.length, 1);
  assert.equal(result.systems[0].star.name, 'Proxima Cen');
  assert.equal(result.systems[0].planets.length, 1);
  assert.equal(result.catalog.identityCandidates[0].name, 'Proxima Centauri');
});
