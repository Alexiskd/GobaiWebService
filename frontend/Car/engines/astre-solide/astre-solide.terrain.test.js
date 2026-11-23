// Tests du relief du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEIGHTMAP_SIZE, MAX_SOURCES, TERRAIN_MAX_LEVEL, createTerrainProvider, mercatorPixel, terrariumAt, tilePlan } from './astre-solide.terrain.js';

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

test('altitude d\'un pixel : décodée, mer ramenée à 0, tuiles de 512 pixels', () => {
  assert.equal(terrariumAt(rgba, 256, 100, 10), 100);
  assert.equal(terrariumAt(rgba, 256, 100, 200), 0);
  const big = new Uint8ClampedArray(512 * 512 * 4).fill(0); big.set([...enc(1234), 255], (2 * 512 + 2) * 4);
  assert.equal(terrariumAt(big, 512, 1, 1), 1234);
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
