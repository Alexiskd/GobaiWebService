// Lancer : npx tsx --test src/earth-trek/earth-trek.core.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { EarthTrekCore, EarthTrekError, TileCache } from './earth-trek.core';
import { EARTH_TREK_LAYERS } from './earth-trek.layers';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const reply = (status: number, type = 'image/jpeg', body: Buffer = jpeg) => ({
  status,
  headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? type : null) },
  arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
});

function recorder(responses: ReturnType<typeof reply>[] | ((url: string) => ReturnType<typeof reply>)) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    return typeof responses === 'function' ? responses(url) : responses.shift()!;
  };
  return { fetch, calls };
}

const ENV_ALL = { MAPBOX_ACCESS_TOKEN: 'pk.test', MAXAR_API_KEY: 'mx-secret', ESRI_API_KEY: 'esri-secret' };

test('Couches : disponibilité selon les clés, jamais de clé ni d’URL fournisseur exposée', () => {
  const none = new EarthTrekCore({}).layers();
  assert.deepEqual(none.filter((l) => l.available).map((l) => l.id), ['esri-world-imagery']);
  assert.match(none.find((l) => l.id === 'mapbox-satellite')!.reason!, /MAPBOX_ACCESS_TOKEN/);
  const all = new EarthTrekCore(ENV_ALL).layers();
  assert.equal(all.filter((l) => l.available).length, EARTH_TREK_LAYERS.length);
  const json = JSON.stringify(all);
  for (const secret of ['pk.test', 'mx-secret', 'esri-secret', 'api.mapbox.com', 'api.maxar.com', 'arcgis']) {
    assert.ok(!json.includes(secret), `« ${secret} » ne doit pas apparaître`);
  }
  assert.equal(all[0].tileUrl, '/api/v1/earth-trek/tiles/esri-world-imagery/{z}/{x}/{y}');
  assert.ok(all.every((l) => l.body === 'earth' && l.attributionText));
  assert.equal(new EarthTrekCore({ EARTH_TREK_ESRI_PUBLIC: 'false' }).layers()[0].available, false);
});

test('URL des fournisseurs : ordre des coordonnées et passage des clés', async () => {
  const { fetch, calls } = recorder(() => reply(200));
  const core = new EarthTrekCore(ENV_ALL, { fetch });
  await core.tile('esri-world-imagery', 5, 16, 11);
  await core.tile('mapbox-satellite', 5, 16, 11);
  await core.tile('mapbox-satellite-streets', 5, 16, 11);
  await core.tile('maxar-vivid', 5, 16, 11);
  await core.tile('maxar-streaming', 5, 16, 11);
  assert.equal(calls[0].url, 'https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/5/11/16?token=esri-secret');
  assert.equal(calls[1].url, 'https://api.mapbox.com/v4/mapbox.satellite/5/16/11@2x.jpg90?access_token=pk.test');
  assert.equal(calls[2].url, 'https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/256/5/16/11@2x?access_token=pk.test');
  const vivid = new URL(calls[3].url);
  assert.equal(vivid.origin + vivid.pathname, 'https://api.maxar.com/basemaps/v1/ogc/gwc/service/wmts');
  assert.equal(vivid.searchParams.get('tileMatrix'), 'EPSG:3857:5');
  assert.equal(vivid.searchParams.get('tileCol'), '16');
  assert.equal(vivid.searchParams.get('tileRow'), '11');
  assert.match(vivid.searchParams.get('cql_filter')!, /VIVID/);
  assert.ok(!calls[3].url.includes('mx-secret'), 'la clé Maxar passe par l’en-tête');
  assert.equal(calls[3].headers['maxar-api-key'], 'mx-secret');
  assert.match(calls[4].url, /^https:\/\/api\.maxar\.com\/streaming\/v1\/ogc\/gwc\/service\/wmts\?/);
  const publicEsri = recorder(() => reply(200));
  await new EarthTrekCore({}, { fetch: publicEsri.fetch }).tile('esri-world-imagery', 3, 4, 2);
  assert.equal(publicEsri.calls[0].url, 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/4');
});

test('Cache : une seule requête pour la même tuile, même en parallèle', async () => {
  const { fetch, calls } = recorder(() => reply(200));
  const core = new EarthTrekCore(ENV_ALL, { fetch });
  const results = await Promise.all([1, 2, 3].map(() => core.tile('mapbox-satellite', 4, 3, 5)));
  assert.equal(calls.length, 1);
  assert.ok(results.every((r) => r.status === 200 && r.body!.equals(jpeg)));
  const again = await core.tile('mapbox-satellite', '4', '3', '5.jpg');
  assert.equal(again.cache, 'hit');
  assert.equal(calls.length, 1);
});

test('Erreurs : coordonnées, clé manquante, clé refusée, quota, tuile absente', async () => {
  const core = new EarthTrekCore({}, { fetch: recorder(() => reply(200)).fetch });
  await assert.rejects(core.tile('inconnue', 1, 0, 0), (e: EarthTrekError) => e.status === 404);
  await assert.rejects(core.tile('esri-world-imagery', 2, 4, 0), (e: EarthTrekError) => e.status === 400);
  await assert.rejects(core.tile('esri-world-imagery', 25, 0, 0), (e: EarthTrekError) => e.status === 400);
  await assert.rejects(core.tile('mapbox-satellite', 1, 0, 0), (e: EarthTrekError) => e.status === 503 && /MAPBOX_ACCESS_TOKEN/.test(e.message));

  const answers = [reply(401), reply(429), reply(404), reply(200, 'application/vnd.ogc.se_xml', Buffer.from('<x/>'))];
  const strict = new EarthTrekCore(ENV_ALL, { fetch: recorder(answers).fetch });
  await assert.rejects(strict.tile('maxar-vivid', 1, 0, 0), (e: EarthTrekError) => e.status === 502 && /clé refusée/.test(e.message));
  await assert.rejects(strict.tile('maxar-vivid', 1, 1, 0), (e: EarthTrekError) => e.status === 503 && /quota/.test(e.message));
  assert.equal((await strict.tile('maxar-vivid', 1, 0, 1)).status, 204);
  assert.equal((await strict.tile('maxar-vivid', 1, 1, 1)).status, 204, 'exception OGC en XML → pas de tuile');
});

test('Cache LRU : borné en octets, la tuile la moins récemment utilisée part en premier', () => {
  const cache = new TileCache(3 * (100 + 64));
  const tile = () => ({ status: 200 as const, body: Buffer.alloc(100), contentType: 'image/jpeg', cache: 'miss' as const });
  cache.set('a', tile(), 1000, 0);
  cache.set('b', tile(), 1000, 0);
  cache.set('c', tile(), 1000, 0);
  assert.ok(cache.get('a', 1)); // « a » redevient la plus récente
  cache.set('d', tile(), 1000, 1);
  assert.equal(cache.get('b', 2), null, 'b évincée');
  assert.ok(cache.get('a', 2) && cache.get('c', 2) && cache.get('d', 2));
  assert.equal(cache.get('a', 5000), null, 'expirée');
});

test('Étapes : fond conseillé remplacé par un fond disponible si sa clé manque', () => {
  const stops = new EarthTrekCore({}).stops();
  assert.ok(stops.length >= 20);
  assert.ok(stops.every((s) => s.layer === 'esri-world-imagery'));
  assert.ok(stops.every((s) => Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180 && s.altitudeKm > 0));
  const full = new EarthTrekCore(ENV_ALL).stops();
  assert.equal(full.find((s) => s.id === 'paris')!.layer, 'mapbox-satellite-streets');
});
