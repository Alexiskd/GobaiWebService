import test from 'node:test';
import assert from 'node:assert/strict';
import { GaiaStarfieldLayer } from './GaiaStarfieldLayer.js';

class Color { setHSL(h, s, l) { this.r = h; this.g = s; this.b = l; } }
class BufferGeometry {
  constructor() { this.attributes = {}; this.disposed = false; this.drawRange = { start: 0, count: Infinity }; }
  setAttribute(k, v) { this.attributes[k] = v; }
  setDrawRange(start, count) { this.drawRange = { start, count }; }
  computeBoundingSphere() {}
  dispose() { this.disposed = true; }
}
class BufferAttribute { constructor(array, size) { this.array = array; this.itemSize = size; this.needsUpdate = false; } setUsage(value) { this.usage = value; } }
class PointsMaterial { constructor(options) { Object.assign(this, options); } dispose() { this.disposed = true; } }
class Points { constructor(geometry, material) { this.geometry = geometry; this.material = material; } }
const THREE = { BufferGeometry, BufferAttribute, PointsMaterial, Points, Color, DynamicDrawUsage: 35048 };
const scene = { children: [], add(item) { this.children.push(item); }, remove(item) { this.children = this.children.filter((entry) => entry !== item); } };
const makeLayer = (budget = {}) => new GaiaStarfieldLayer({ THREE, scene, parsecToSceneUnits: 10, budget });

test('GaiaStarfieldLayer regroupe les étoiles en un unique draw object et convertit les axes ICRS', () => {
  const layer = makeLayer();
  layer.setStars([{ id: 'gaia:1', positionPc: { x: 1, y: 2, z: 3 }, colorIndex: 0.5, magnitude: 5 }]);
  assert.equal(layer.getStats().stars, 1);
  assert.equal(layer.getStats().drawCalls, 1);
  assert.deepEqual([...layer.geometry.attributes.position.array.slice(0, 3)], [10, 30, -20]);
  assert.deepEqual(layer.geometry.drawRange, { start: 0, count: 1 });
  layer.updateOrigin({ x: 1, y: 1, z: 1 });
  assert.deepEqual([...layer.geometry.attributes.position.array.slice(0, 3)], [0, 20, -10]);
  layer.dispose();
  assert.equal(scene.children.length, 0);
});

test('les buffers sont préalloués et réutilisés tant que la capacité suffit', () => {
  const layer = makeLayer({ maxStars: 2048 });
  const stars = Array.from({ length: 300 }, (_, i) => ({ id: `gaia:${i}`, positionPc: { x: i, y: 0, z: 0 }, magnitude: 8 }));
  layer.setStars(stars);
  const capacity = layer.getStats().bufferCapacity;
  const positionBuffer = layer.geometry.attributes.position.array;
  layer.setStars([{ id: 'gaia:300', positionPc: { x: 300, y: 0, z: 0 }, magnitude: 8 }]);
  assert.equal(layer.getStats().bufferCapacity, capacity);
  assert.equal(layer.geometry.attributes.position.array, positionBuffer);
  assert.equal(layer.geometry.attributes.position.needsUpdate, true);
  assert.ok(layer.getStats().gpuBufferBytes > 0);
  layer.dispose();
});

test('le LOD applique résidence, magnitude et budget maximum', () => {
  const layer = makeLayer({ maxStars: 2, maxMagnitude: 8 });
  layer.setStars([
    { id: 'bright', positionPc: { x: 1, y: 0, z: 0 }, magnitude: 1 },
    { id: 'dim', positionPc: { x: 2, y: 0, z: 0 }, magnitude: 7 },
    { id: 'too-dim', positionPc: { x: 3, y: 0, z: 0 }, magnitude: 12 },
  ]);
  assert.equal(layer.getStats().renderedStars, 2);
  layer.setResidentIds(['dim']);
  assert.equal(layer.getStats().renderedStars, 1);
  layer.setRenderBudget({ maxStars: 1, maxMagnitude: 20, pointSize: 3 });
  layer.setResidentIds(null);
  assert.equal(layer.getStats().renderedStars, 1);
  assert.equal(layer.getStats().truncatedStars, 2);
  assert.equal(layer.material.size, 3);
  layer.dispose();
});

test('le budget de distance masque les étoiles hors du rayon', () => {
  const layer = makeLayer({ maxDistancePc: 5 });
  layer.setStars([
    { id: 'near', positionPc: { x: 3, y: 0, z: 0 }, magnitude: 4 },
    { id: 'far', positionPc: { x: 8, y: 0, z: 0 }, magnitude: 4 },
  ]);
  assert.equal(layer.getStats().renderedStars, 1);
  layer.dispose();
});
