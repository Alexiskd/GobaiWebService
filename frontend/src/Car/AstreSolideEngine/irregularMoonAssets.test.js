import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

for (const name of ['phobos', 'deimos']) {
  test(`le modèle statique ${name}.glb est un GLB 2.0 autonome`, async () => {
    const bytes = await readFile(new URL(`../../../public/models/${name}.glb`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
    const jsonLength = bytes.readUInt32LE(12);
    assert.equal(bytes.toString('ascii', 16, 20), 'JSON');
    const document = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
    assert.ok(document.meshes?.length);
    assert.ok(document.accessors?.some((item) => item.type === 'VEC3'));
    assert.ok(document.buffers?.[0]?.byteLength > 0);
  });
}
