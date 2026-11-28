// Tests du relief du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHTMAP_SIZE, MAX_SOURCES, TERRAIN_MAX_LEVEL, bodyTilePlan, createBodyTerrainProvider, createTerrainProvider, heightsFor, mercatorPixel, terrariumAt, tilePlan } from './astre-solide.terrain.js';

// Tuile Terrarium de 256 × 256 pixels : altitude = colonne (m), moitié basse sous la mer.
const enc = (m) => { const v = m + 32768; return [Math.floor(v / 256), Math.floor(v % 256), 0]; };
const rgba = new Uint8ClampedArray(256 * 256 * 4);
for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) rgba.set([...enc(y >= 128 ? -300 : x), 255], (y * 256 + x) * 4);

test('pixel Web Mercator : équateur, méridien de Greenwich, bornes', () => {
  assert.deepEqual(mercatorPixel(0, 0, 0), { x: 128, y: 128 });
  assert.equal(mercatorPixel(180, 0, 1).x, 511);
  assert.ok(mercatorPixel(0, 90, 0).y < 1e-6);
  assert.ok(Math.abs(mercatorPixel(0, -90, 0).y - 255) < 1e-6);
});

test('altitude d\'un pixel : décodée, mer ramenée à 0, tuiles de 512 pixels, relief signé', () => {
  assert.equal(terrariumAt(rgba, 256, 100, 10), 100);
  assert.equal(terrariumAt(rgba, 256, 100, 200), 0);
  // Relief signé (Lune, Mars, Mercure, Vénus) : le négatif est gardé (bassin sous la sphère de référence).
  assert.equal(terrariumAt(rgba, 256, 100, 200, true), -300);
  const big = new Uint8ClampedArray(512 * 512 * 4).fill(0); big.set([...enc(1234), 255], (2 * 512 + 2) * 4);
  assert.equal(terrariumAt(big, 512, 1, 1), 1234);
  // Lecture bilinéaire : entre les colonnes 100 et 101, la pente est suivie (plus de marches d'escalier).
  assert.equal(terrariumAt(rgba, 256, 100.5, 10), 100.5);
  assert.equal(terrariumAt(rgba, 256, 100.25, 10), 100.25);
});

test('tuile source en échec : refusée en tuile fine (parente agrandie), plate en tuile racine', async () => {
  const plan = { tiles: [['a', {}], ['b', {}]], points: [{ key: 'a', u: 5, v: 0 }, { key: 'b', u: 7, v: 0 }] };
  const get = (t) => (t === plan.tiles[1][1] ? Promise.reject(new Error('502')) : Promise.resolve({ rgba, size: 256 }));
  // Tuile fine : refusée, CesiumJS reprend sa parente.
  await assert.rejects(heightsFor(plan, get, 5));
  // Tuile racine (relief lu dès le niveau 0) : le globe s'affiche, 0 m là où la donnée manque.
  assert.deepEqual([...(await heightsFor(plan, get, 0, false, { minLevel: 0 }))], [5, 0]);
  // Niveaux grossiers : plat, sans aucun téléchargement.
  let asked = 0; const h = await heightsFor(plan, () => { asked++; return Promise.resolve({ rgba, size: 256 }); }, 1);
  assert.deepEqual([...h], [0, 0]); assert.equal(asked, 0);
  // Source trop lente : tuile fine refusée après le délai (CesiumJS reprend la parente).
  await assert.rejects(heightsFor(plan, () => new Promise(() => {}), 5, false, { timeoutMs: 20 }));
});

test('plan d\'une tuile d\'astre : découpage géographique 2^(z+1) × 2^z, niveau borné à la source', () => {
  // Niveau 0 du globe : 2 × 1 tuiles, la tuile 0/0/0 couvre l'ouest ; niveau source = 0.
  const p0 = bodyTilePlan(0, 0, 0, { minZoom: 3, maxZoom: 8 });
  assert.equal(p0.z, 0); // même niveau que le globe : une seule tuile source pour une tuile racine (plus 64)
  assert.equal(p0.tiles.length, 1);
  assert.equal(p0.points.length, HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  // Coin nord-ouest de la tuile : pixel (0, 0) de la tuile source 0/0/0.
  assert.deepEqual(p0.points[0], { key: '0/0/0', u: 0, v: 0 });
  // Niveau 8 du globe : niveau source borné au maxZoom 8.
  const p8 = bodyTilePlan(510, 254, 8, { minZoom: 3, maxZoom: 8 });
  assert.equal(p8.z, 8);
  // Niveau 12 du globe : au-delà du maxZoom, la tuile du niveau 8 est agrandie (échantillonnée).
  const p12 = bodyTilePlan(4000, 2000, 12, { minZoom: 3, maxZoom: 8 });
  assert.equal(p12.z, 8);
  assert.ok(p12.tiles.every(([, t]) => t.z === 8));
});

test('fournisseur d\'un astre : tuiles Terrarium du serveur, une fois chacune, relief signé', async () => {
  const urls = [];
  const Cesium = { CustomHeightmapTerrainProvider: class { constructor(o) { Object.assign(this, o); } }, GeographicTilingScheme: class { constructor(o) { Object.assign(this, o); } } };
  const p = createBodyTerrainProvider(Cesium, {}, { template: '/api/v1/tiles/relief/venus/{z}/{x}/{y}.png', minZoom: 3, maxZoom: 5, signed: true }, async (u) => { urls.push(u); return { rgba, size: 256 }; });
  assert.equal(p.width, HEIGHTMAP_SIZE);
  // Tuile du niveau 4 : lue dans la tuile source 4 (dans les bornes 3..5) ; le sud de la tuile est à −300 m, gardé (signé).
  const h = await p.callback(30, 15, 4);
  assert.equal(h.length, HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  assert.equal(h[0], 0); // coin nord-ouest = pixel (0,0) = 0 m
  assert.equal(h[(HEIGHTMAP_SIZE - 1) * HEIGHTMAP_SIZE], -300); // bord sud = pixel (·,255) = −300 m signé
  // Encore la même tuile : aucune nouvelle lecture.
  await p.callback(30, 15, 4);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((u) => u.startsWith('/api/v1/tiles/relief/venus/4/')));
  // Niveau 9 : au-delà du maxZoom 5, lu dans la tuile du niveau 5.
  await p.callback(500, 250, 9);
  assert.ok(urls.some((u) => u.startsWith('/api/v1/tiles/relief/venus/5/')));
});

test('plan d\'une tuile : niveau de même largeur, peu de tuiles sources, niveau 12 au plus', () => {
  const p = tilePlan(2048, 600, 11);
  assert.equal(p.z, 12); assert.equal(p.points.length, HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  assert.ok(p.tiles.length <= MAX_SOURCES);
  assert.equal(tilePlan(100000, 30000, 17).z, TERRAIN_MAX_LEVEL);
  // Près du pôle : un niveau plus grossier pour ne pas lire trop de tuiles.
  const polar = tilePlan(0, 0, 3);
  assert.ok(polar.tiles.length <= MAX_SOURCES); assert.ok(polar.z < 4);
});

test('fournisseur : grille de 65 points, tuiles sources téléchargées une fois', async () => {
  const urls = [];
  const Cesium = { CustomHeightmapTerrainProvider: class { constructor(o) { Object.assign(this, o); } }, GeographicTilingScheme: class {} };
  const p = createTerrainProvider(Cesium, {}, async (u) => { urls.push(u); return { rgba, size: 256 }; });
  assert.equal(p.width, HEIGHTMAP_SIZE);
  const a = await p.callback(2048, 600, 11); await p.callback(2048, 600, 11);
  assert.equal(a.length, HEIGHTMAP_SIZE * HEIGHTMAP_SIZE);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every((u) => u.startsWith('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/')));
});
