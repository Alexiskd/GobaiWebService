import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeChunk, encodeChunk, FILE_CHUNK, TILE_CHUNK, HEADER_BYTES, randomRoomCode, safeFileName } from './protocol.js';

test('une trame binaire traverse encode → decode sans perte', () => {
  const payload = new Uint8Array([1, 2, 3, 250]).buffer;
  const frame = encodeChunk(TILE_CHUNK, 4294967295, 7, payload);
  assert.equal(frame.byteLength, HEADER_BYTES + 4);
  const got = decodeChunk(frame);
  assert.deepEqual(got, { type: TILE_CHUNK, id: 4294967295, seq: 7, payload });
});

test('encodeChunk accepte une vue sur un tampon plus grand', () => {
  const big = new Uint8Array([9, 8, 7, 6, 5, 4]);
  const frame = encodeChunk(FILE_CHUNK, 2, 3, big.subarray(2, 5));
  const got = decodeChunk(frame);
  assert.deepEqual([...new Uint8Array(got.payload)], [7, 6, 5]);
});

test('decodeChunk refuse les trames courtes ou inconnues', () => {
  assert.equal(decodeChunk(new ArrayBuffer(4)), null);
  const bad = new Uint8Array(HEADER_BYTES);
  bad[0] = 99;
  assert.equal(decodeChunk(bad.buffer), null);
  assert.equal(decodeChunk('texte'), null);
});

test('les codes de salon sont lisibles et de la bonne longueur', () => {
  for (let i = 0; i < 50; i++) {
    const code = randomRoomCode();
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
  }
});

test('safeFileName retire les caractères de chemin', () => {
  assert.equal(safeFileName('../../etc/passwd'), '.._.._etc_passwd');
  assert.equal(safeFileName('photo été.png'), 'photo été.png');
  assert.equal(safeFileName(''), 'fichier');
});
