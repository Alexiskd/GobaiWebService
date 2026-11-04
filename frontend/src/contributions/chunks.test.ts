import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPointChunks } from './chunks.ts';

test('spatial chunks carry centered meter coordinates and progressive LOD levels', () => {
  const chunks = buildPointChunks(
    new Float64Array([0, 0, 0, 100, 0, 0, 0, 100, 0, 100, 100, 10]),
    new Uint8Array([
      255, 0, 0, 255,
      0, 255, 0, 255,
      0, 0, 255, 255,
      255, 255, 255, 255,
    ]),
    { minX: 0, minY: 0, minZ: 0, maxX: 100, maxY: 100, maxZ: 10 },
    [100, 100, 10],
  );
  assert.equal(chunks.length, 4);
  assert.deepEqual(chunks[0].levels.map((level) => level.stride), [1, 4, 16]);
  assert.deepEqual([...chunks[0].levels[0].positions], [-50, -50, -5]);
  assert.equal(chunks[0].levels[0].colors[3], 255);
  assert.ok(chunks.every((chunk) => chunk.pointCount === 1));
});

test('coincident points are deterministically split to respect the per-chunk point cap', () => {
  const pointCount = 100_001;
  const positions = new Float32Array(pointCount * 3);
  const chunks = buildPointChunks(
    positions,
    null,
    { minX: -1, minY: -1, minZ: -1, maxX: 1, maxY: 1, maxZ: 1 },
    [1, 1, 1],
  );
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks.map((chunk) => chunk.pointCount), [100_000, 1]);
});

test('flat LAS extents remain importable without inventing vertical point offsets', () => {
  const [chunk] = buildPointChunks(
    new Float32Array([0, 0, 5, 10, 10, 5]),
    null,
    { minX: 0, minY: 0, minZ: 5, maxX: 10, maxY: 10, maxZ: 5 },
    [10, 10, 1],
  );
  assert.deepEqual([...chunk.levels[0].positions], [-5, -5, 0, 5, 5, 0]);
});
