import test from 'node:test';
import assert from 'node:assert/strict';
import { GaiaDR3SectorStreamer, gaiaRecordToHeliocentricParsecs } from './GaiaDR3SectorStreamer.js';
import { GaiaSectorCache } from './GaiaSectorCache.js';

const record = (id, parallax = 100, ra = 0, dec = 0) => ({ id: `gaia-dr3:${id}`, sourceId: id, coordinates: { raDeg: ra, decDeg: dec }, astrometry: { parallaxMas: parallax }, photometry: { gaiaG: 8, gaiaBpMinusRp: 0.7 } });

test('conversion Gaia ICRS -> parsecs héliocentriques', () => {
  const p = gaiaRecordToHeliocentricParsecs(record('1', 100, 0, 0));
  assert.ok(Math.abs(p.x - 10) < 1e-9); assert.equal(p.y, 0); assert.equal(p.z, 0);
  assert.equal(gaiaRecordToHeliocentricParsecs(record('2', 0)), null);
});

test('streamer télécharge un cône, convertit les parallaxes et met en cache', async () => {
  let calls = 0;
  const service = { async searchGaiaCone() { calls += 1; return { records: [record('1'), record('2', null)], retrievedAt: '2026-01-01' }; } };
  const cache = new GaiaSectorCache({ indexedDB: null });
  const streamer = new GaiaDR3SectorStreamer({ catalogService: service, cache });
  const cone = { raDeg: 0, decDeg: 0, radiusDeg: 1, limit: 20 };
  const first = await streamer.loadCone(cone); const second = await streamer.loadCone(cone);
  assert.equal(first.count, 1); assert.equal(second.cache, 'hit'); assert.equal(calls, 1);
  assert.equal(streamer.getStats().rejectedNoParallax, 1);
});

test('streamer valide les cônes et respecte une annulation avant chargement', async () => {
  const streamer = new GaiaDR3SectorStreamer({ catalogService: { searchGaiaCone: async () => ({ records: [] }) }, cache: new GaiaSectorCache({ indexedDB: null }) });
  await assert.rejects(streamer.loadCone({ raDeg: 0, decDeg: 91, radiusDeg: 1 }), /Cône Gaia invalide/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(streamer.loadCone({ raDeg: 0, decDeg: 0, radiusDeg: 1 }, { signal: controller.signal }));
});

test('dispose annule les requêtes en cours', async () => {
  let signal;
  const service = { searchGaiaCone: (_cone, options) => new Promise((resolve, reject) => { signal = options.signal; signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); }) };
  const streamer = new GaiaDR3SectorStreamer({ catalogService: service, cache: new GaiaSectorCache({ indexedDB: null }) });
  const pending = streamer.loadCone({ raDeg: 0, decDeg: 0, radiusDeg: 1 });
  await new Promise((resolve) => setImmediate(resolve)); streamer.dispose();
  await assert.rejects(pending); assert.equal(signal.aborted, true);
});

test('pagination keyset charge plusieurs pages sans doublons et respecte maxPages', async () => {
  const calls = [];
  const service = { async searchGaiaCone(cone) {
    calls.push(cone.sourceIdAfter ?? null);
    const rows = cone.sourceIdAfter === null
      ? [record('10'), record('20')]
      : cone.sourceIdAfter === '20' ? [record('20'), record('30')] : [];
    return { records: rows };
  } };
  const streamer = new GaiaDR3SectorStreamer({ catalogService: service, cache: new GaiaSectorCache({ indexedDB: null }), maxStarsPerCone: 2 });
  const result = await streamer.loadConePages({ raDeg: 10, decDeg: 5, radiusDeg: 1, limit: 2 }, { maxPages: 2 });
  assert.equal(result.pagesLoaded, 2);
  assert.equal(result.count, 3);
  assert.equal(result.hasMore, true);
  assert.equal(result.nextSourceIdAfter, '30');
  assert.deepEqual(calls, [null, '20']);
  streamer.dispose();
});
