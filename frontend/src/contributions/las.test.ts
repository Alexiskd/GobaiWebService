import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLasHeader, validateLasMetadata } from './las.ts';

test('LAS 1.4 header reads extended point count, scale, bounds and compression flags', () => {
  const buffer = new ArrayBuffer(405);
  const view = new DataView(buffer);
  new TextEncoder().encodeInto('LASF', new Uint8Array(buffer, 0, 4));
  view.setUint8(24, 1);
  view.setUint8(25, 4);
  view.setUint16(94, 375, true);
  view.setUint32(96, 375, true);
  view.setUint8(104, 0x80);
  view.setUint16(105, 30, true);
  view.setUint32(107, 2, true);
  view.setFloat64(131, 0.01, true);
  view.setFloat64(139, 0.01, true);
  view.setFloat64(147, 0.01, true);
  view.setFloat64(179, 11, true);
  view.setFloat64(187, 1, true);
  view.setFloat64(195, 22, true);
  view.setFloat64(203, 2, true);
  view.setFloat64(211, 33, true);
  view.setFloat64(219, 3, true);
  view.setBigUint64(247, 3n, true);

  const header = parseLasHeader(buffer);
  assert.equal(header.version, '1.4');
  assert.equal(header.pointCount, 3);
  assert.equal(header.compressed, true);
  assert.deepEqual(header.scale, [0.01, 0.01, 0.01]);
  assert.deepEqual(header.bounds, { minX: 1, maxX: 11, minY: 2, maxY: 22, minZ: 3, maxZ: 33 });
  validateLasMetadata(header, buffer.byteLength);
});

test('LAS metadata rejects oversized point counts and malformed signatures', () => {
  const buffer = new ArrayBuffer(405);
  const view = new DataView(buffer);
  new TextEncoder().encodeInto('LASF', new Uint8Array(buffer, 0, 4));
  view.setUint8(24, 1);
  view.setUint8(25, 2);
  view.setUint16(94, 227, true);
  view.setUint32(96, 227, true);
  view.setUint16(105, 20, true);
  view.setUint32(107, 10_000_001, true);
  view.setFloat64(131, 0.01, true);
  view.setFloat64(139, 0.01, true);
  view.setFloat64(147, 0.01, true);
  view.setFloat64(179, 1, true);
  view.setFloat64(187, 0, true);
  view.setFloat64(195, 1, true);
  view.setFloat64(203, 0, true);
  view.setFloat64(211, 1, true);
  view.setFloat64(219, 0, true);
  assert.throws(() => validateLasMetadata(parseLasHeader(buffer), buffer.byteLength), /10/);

  new Uint8Array(buffer, 0, 4).fill(0);
  assert.throws(() => parseLasHeader(buffer), /LASF/);
});
