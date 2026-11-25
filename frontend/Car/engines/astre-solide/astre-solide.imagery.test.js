// Tests du fond de carte de l'app lu par CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { imageryOptions, templateOf, tileSourceImageryProvider } from './astre-solide.imagery.js';
import { baseColorOf } from './astre-solide.viewer.js';
import { threeViewToCesium, tilesLocalToEcef, EARTH_RADIUS_M } from './astre-solide.camera-math.js';

// Faux CesiumJS : seulement ce que le fournisseur utilise.
const FakeCesium = {
  GeographicTilingScheme: class { constructor(o) { this.kind = 'geographic'; this.ellipsoid = o.ellipsoid; this.rectangle = 'monde'; } },
  WebMercatorTilingScheme: class { constructor(o) { this.kind = 'webmercator'; this.ellipsoid = o.ellipsoid; this.rectangle = 'mercator'; } },
  Event: class {},
  Credit: class { constructor(t) { this.text = t; } },
  UrlTemplateImageryProvider: class { constructor(o) { Object.assign(this, o); this.kind = 'url'; } },
};

test('imagerie : source avec adresse de tuiles → fournisseur d\'adresses de CesiumJS, même découpage', () => {
  assert.equal(templateOf({ info: { urlTemplate: '/api/v1/tiles/mars-viking/{z}/{x}/{y}' } }), '/api/v1/tiles/mars-viking/{z}/{x}/{y}');
  assert.equal(templateOf({ info: { urlTemplate: '/x/{z}' } }), null);
  assert.equal(templateOf(null), null);
  const source = { minZoom: 0, maxZoom: 7, info: { urlTemplate: '/api/v1/tiles/mars-viking/{z}/{x}/{y}' }, loadImage: async () => null };
  const p = tileSourceImageryProvider(FakeCesium, { source, projectionId: 'equirectangular', ellipsoid: 'mars', credit: 'Mars Trek' });
  assert.equal(p.kind, 'url');
  assert.equal(p.url, '/api/v1/tiles/mars-viking/{z}/{x}/{y}');
  assert.equal(p.tilingScheme.kind, 'geographic'); assert.equal(p.tilingScheme.ellipsoid, 'mars');
  assert.equal(p.maximumLevel, 7); assert.equal(p.credit.text, 'Mars Trek');
});

test('globe : sol à la teinte de l\'astre, jamais le bleu de CesiumJS', () => {
  for (const id of ['moon', 'mars', 'mercury', 'venus', 'io']) assert.match(baseColorOf(id), /^#[0-9a-f]{6}$/);
  assert.notEqual(baseColorOf('venus'), baseColorOf('mars'));
});

test('imagerie : découpage NASA Trek (plate carrée) ou Web Mercator, niveaux de la source', () => {
  assert.deepEqual(imageryOptions({ minZoom: 0, maxZoom: 7 }, 'equirectangular'), { scheme: 'geographic', minimumLevel: 0, maximumLevel: 7, tileSize: 256 });
  assert.deepEqual(imageryOptions({ minZoom: 2, maxZoom: 9 }, 'mercator'), { scheme: 'webmercator', minimumLevel: 2, maximumLevel: 9, tileSize: 256 });
  // Source sans niveaux : 0.
  assert.deepEqual(imageryOptions(null, 'mercator'), { scheme: 'webmercator', minimumLevel: 0, maximumLevel: 0, tileSize: 256 });
});

test('imagerie : le fournisseur lit la source de tuiles de l\'app au même endroit', async () => {
  // Source qui note les tuiles demandées.
  const asked = [];
  const source = { minZoom: 0, maxZoom: 5, loadImage: async (c) => { asked.push(c); return { tuile: c }; } };
  // Fournisseur pour la Lune (plate carrée).
  const p = tileSourceImageryProvider(FakeCesium, { source, projectionId: 'equirectangular', ellipsoid: 'lune', credit: 'NASA Trek' });
  // Découpage géographique sur l'ellipsoïde de la Lune, niveaux de la source.
  assert.equal(p.tilingScheme.kind, 'geographic');
  assert.equal(p.tilingScheme.ellipsoid, 'lune');
  assert.equal(p.maximumLevel, 5);
  assert.equal(p.credit.text, 'NASA Trek');
  // Tuile (x 3, y 1, niveau 2) : même tuile demandée à la source.
  const img = await p.requestImage(3, 1, 2);
  assert.deepEqual(asked, [{ z: 2, x: 3, y: 1 }]);
  assert.deepEqual(img, { tuile: { z: 2, x: 3, y: 1 } });
  // Tuile vide : rejet (CesiumJS garde le niveau au-dessus).
  const empty = tileSourceImageryProvider(FakeCesium, { source: { maxZoom: 3, loadImage: async () => null }, projectionId: 'mercator', ellipsoid: 'mars' });
  await assert.rejects(empty.requestImage(0, 0, 1));
});

test('astres solides : vue three.js traduite au rayon de l\'astre (Lune)', () => {
  // Rayon de la Lune (m).
  const R = 1737400;
  // Caméra à 3 rayons de la Lune.
  const v = threeViewToCesium({ pos: [3, 0, 0], dir: [-1, 0, 0], up: [0, 1, 0] }, { fovyDeg: 45, aspect: 1, radiusM: R });
  // Position en mètres de la Lune.
  assert.equal(v.position.x, 3 * R);
  // Plan lointain au-delà de la face cachée de la Lune (et non de la Terre).
  assert.equal(v.far, 5 * R);
  assert.ok(v.far < 5 * EARTH_RADIUS_M);
  // Aller : un rayon de la Lune.
  assert.equal(tilesLocalToEcef([0, 1, 0], R).z, R);
});
