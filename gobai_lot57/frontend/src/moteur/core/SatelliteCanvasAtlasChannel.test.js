import test from 'node:test';
import assert from 'node:assert/strict';
import { createSatelliteCanvasAtlasChannel } from './SatelliteCanvasAtlasChannel.js';

function mockEnvironment() {
  const calls = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => calls.push(args) }) };
  class CanvasTexture {
    constructor(image) { this.image = image; }
  }
  const THREE = {
    CanvasTexture,
    LinearMipmapLinearFilter: 'mipmap-linear',
    LinearFilter: 'linear',
    ClampToEdgeWrapping: 'clamp',
  };
  const documentRef = { createElement: (tag) => { assert.equal(tag, 'canvas'); return canvas; } };
  return { THREE, documentRef, canvas, calls };
}

test('crée une page CanvasTexture avec mipmaps et filtrage', () => {
  const env = mockEnvironment();
  const channel = createSatelliteCanvasAtlasChannel(env.THREE, { documentRef: env.documentRef, anisotropy: 4 });
  const page = channel.createPage({ pageSize: 1024 });
  assert.equal(page.canvas.width, 1024);
  assert.equal(page.canvas.height, 1024);
  assert.equal(page.texture.flipY, true);
  assert.equal(page.texture.generateMipmaps, true);
  assert.equal(page.texture.minFilter, 'mipmap-linear');
  assert.equal(page.texture.magFilter, 'linear');
  assert.equal(page.texture.anisotropy, 4);
});

test('copie la source et extrude les bords dans le gutter', () => {
  const env = mockEnvironment();
  const channel = createSatelliteCanvasAtlasChannel(env.THREE, { documentRef: env.documentRef });
  const page = channel.createPage({ pageSize: 512 });
  channel.blit(page, { width: 256, height: 128 }, { x: 8, y: 12, width: 256, height: 128, gutter: 4 });
  assert.equal(env.calls.length, 9);
  assert.deepEqual(env.calls[0].slice(5), [8, 12, 256, 128]);
});

test('refuse un environnement sans Canvas ou une source invalide', () => {
  assert.throws(() => createSatelliteCanvasAtlasChannel(mockEnvironment().THREE, { documentRef: null }), /Canvas indisponible/);
  const env = mockEnvironment();
  const channel = createSatelliteCanvasAtlasChannel(env.THREE, { documentRef: env.documentRef });
  assert.throws(() => channel.blit(channel.createPage({ pageSize: 64 }), { width: 0, height: 10 }, { x: 1, y: 1, width: 1, height: 1, gutter: 1 }), /Image source invalide/);
});
