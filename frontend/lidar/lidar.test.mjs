import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointReader, crsLabel, readLasHeader, writeLas } from './lasFormat.js';
import { buildOctree } from './octree.js';
import { frustumPlanes, lookAt, mat4, multiply, perspective, project, sphereInFrustum } from './math.js';

const samplePoints = (n) => Array.from({ length: n }, (_, i) => ({
  x: 652_000 + (i % 100) * 0.5,
  y: 6_862_000 + Math.floor(i / 100) * 0.5,
  z: 35 + Math.sin(i) * 2,
  intensity: (i * 37) % 4000,
  returnNumber: 1 + (i % 3),
  numberOfReturns: 3,
  classification: [2, 3, 6, 9][i % 4],
  r: (i * 7) % 65536, g: (i * 11) % 65536, b: (i * 13) % 65536,
}));

test('LAS : en-tête, système de coordonnées et lecture des points (format 2)', () => {
  const points = samplePoints(1234);
  const buffer = writeLas(points, { pointFormat: 2, scale: [0.01, 0.01, 0.01], epsg: 2154 });
  const h = readLasHeader(buffer);
  assert.equal(h.version, '1.2');
  assert.equal(h.pointFormat, 2);
  assert.equal(h.compressed, false);
  assert.equal(h.pointCount, 1234);
  assert.equal(h.hasRgb, true);
  assert.equal(h.crs.epsg, 2154);
  assert.equal(crsLabel(h.crs), 'RGF93 / Lambert-93 (EPSG:2154)');
  const read = createPointReader(h);
  const view = new DataView(buffer);
  for (const i of [0, 1, 617, 1233]) {
    const p = read(view, h.offsetToPointData + i * h.pointRecordLength, {});
    const e = points[i];
    assert.ok(Math.abs(p.x - e.x) < 0.006 && Math.abs(p.y - e.y) < 0.006 && Math.abs(p.z - e.z) < 0.006, `coordonnées du point ${i}`);
    assert.equal(p.intensity, e.intensity);
    assert.equal(p.classification, e.classification);
    assert.equal(p.returnNumber, e.returnNumber);
    assert.equal(p.numberOfReturns, 3);
    assert.deepEqual([p.r, p.g, p.b], [e.r, e.g, e.b]);
  }
});

test('LAS : un fichier qui n’est pas un LAS est refusé clairement', () => {
  assert.throws(() => readLasHeader(new ArrayBuffer(300)), /LASF/);
  assert.throws(() => readLasHeader(new ArrayBuffer(10)), /trop court/);
});

test('LAZ : les bits de compression du format de point sont reconnus', () => {
  const buffer = writeLas(samplePoints(10), { pointFormat: 2 });
  new DataView(buffer).setUint8(104, 2 | 0x80);
  const h = readLasHeader(buffer);
  assert.equal(h.pointFormat, 2);
  assert.equal(h.compressed, true);
});

test('Octree : chaque point est rangé une seule fois, dans un nœud qui le contient, un point par cellule', () => {
  const n = 60_000;
  const positions = new Float32Array(n * 3);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const x = rand() * 400 - 200, y = rand() * 300 - 150, z = Math.sin(x / 30) * 10 + rand();
    positions.set([x, y, z], i * 3);
    [x, y, z].forEach((v, k) => { min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); });
  }
  const grid = 32;
  const tree = buildOctree(positions, n, { min, max }, { grid, minNodePoints: 0 });
  assert.equal(tree.order.length, n);
  const seen = new Uint8Array(n);
  let total = 0;
  for (const node of tree.nodes) {
    total += node.count;
    const cells = new Set();
    for (let j = 0; j < node.count; j++) {
      const i = tree.order[node.start + j];
      assert.equal(seen[i], 0, 'point rangé deux fois');
      seen[i] = 1;
      for (let k = 0; k < 3; k++) {
        const v = positions[i * 3 + k];
        assert.ok(v >= node.min[k] - 1e-3 && v <= node.min[k] + node.size + 1e-3, `point ${i} hors de ${node.key}`);
      }
      if (node.level < tree.maxDepth) {
        const c = [0, 1, 2].map((k) => Math.min(grid - 1, Math.floor((positions[i * 3 + k] - node.min[k]) / (node.size / grid))));
        const key = c.join(',');
        assert.ok(!cells.has(key), `deux points dans la même cellule de ${node.key}`);
        cells.add(key);
      }
    }
    if (node.parent >= 0) assert.ok(tree.nodes[node.parent].children.includes(tree.nodes.indexOf(node)), 'lien parent → enfant');
  }
  assert.equal(total, n);
  assert.ok(tree.nodes[0].count > 0 && tree.nodes[0].count < n, 'la racine est un aperçu, pas tout le nuage');
});

test('Octree : la fusion des petites feuilles garde tous les points et réduit le nombre de nœuds', () => {
  const n = 80_000;
  const positions = new Float32Array(n * 3);
  let seed = 3;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) positions.set([rand() * 500, rand() * 500, rand() * 5], i * 3);
  const bounds = { min: [0, 0, 0], max: [500, 500, 5] };
  const raw = buildOctree(positions, n, bounds, { minNodePoints: 0 });
  const merged = buildOctree(positions, n, bounds, { minNodePoints: 8000 });
  assert.ok(merged.nodes.length < raw.nodes.length, `${merged.nodes.length} nœuds au lieu de ${raw.nodes.length}`);
  assert.equal(merged.nodes.reduce((s, x) => s + x.count, 0), n);
  const seen = new Uint8Array(n);
  merged.order.forEach((i) => { assert.equal(seen[i], 0); seen[i] = 1; });
  merged.nodes.forEach((node, k) => {
    node.children.forEach((c) => { if (c >= 0) assert.equal(merged.nodes[c].parent, k, 'lien enfant → parent'); });
    for (let j = 0; j < node.count; j++) {
      const i = merged.order[node.start + j];
      for (let a = 0; a < 3; a++) assert.ok(positions[i * 3 + a] >= node.min[a] - 1e-3 && positions[i * 3 + a] <= node.min[a] + node.size + 1e-3);
    }
  });
});

test('Caméra : projection d’un point et test du tronc de vision', () => {
  const view = lookAt(mat4(), [0, -10, 0], [0, 0, 0], [0, 0, 1]);
  const proj = perspective(mat4(), Math.PI / 3, 1, 0.1, 100);
  const vp = multiply(mat4(), proj, view);
  const p = project(vp, 0, 0, 0, 800, 600);
  assert.ok(Math.abs(p.x - 400) < 1e-3 && Math.abs(p.y - 300) < 1e-3, 'le point visé est au centre');
  assert.equal(project(vp, 0, -20, 0, 800, 600), null, 'point derrière la caméra');
  const planes = frustumPlanes(vp);
  assert.ok(sphereInFrustum(planes, [0, 0, 0], 1));
  assert.ok(!sphereInFrustum(planes, [0, -30, 0], 1));
  assert.ok(!sphereInFrustum(planes, [200, 0, 0], 1));
});

test('LAS 1.4 : nombre de points sur 64 bits et format étendu 7 (retours sur 4 bits, classe sur 8 bits, couleurs)', () => {
  const headerSize = 375, recordLength = 36;
  const buffer = new ArrayBuffer(headerSize + recordLength);
  const v = new DataView(buffer);
  'LASF'.split('').forEach((c, i) => v.setUint8(i, c.charCodeAt(0)));
  v.setUint8(24, 1); v.setUint8(25, 4);
  v.setUint16(94, headerSize, true);
  v.setUint32(96, headerSize, true);
  v.setUint8(104, 7 | 0x80);             // format 7 compressé
  v.setUint16(105, recordLength, true);
  v.setUint32(107, 0, true);             // champ 32 bits historique vide
  [0.01, 0.01, 0.01].forEach((s, i) => v.setFloat64(131 + i * 8, s, true));
  [650000, 6860000, 0].forEach((o, i) => v.setFloat64(155 + i * 8, o, true));
  v.setBigUint64(247, 1n, true);         // vrai nombre de points
  const o = headerSize;
  v.setInt32(o, 12345, true); v.setInt32(o + 4, -500, true); v.setInt32(o + 8, 4321, true);
  v.setUint16(o + 12, 777, true);
  v.setUint8(o + 14, 2 | (5 << 4));       // retour 2 sur 5
  v.setUint8(o + 16, 66);                 // classe IGN « point virtuel »
  v.setUint16(o + 30, 1000, true); v.setUint16(o + 32, 2000, true); v.setUint16(o + 34, 3000, true);
  const h = readLasHeader(buffer);
  assert.equal(h.version, '1.4');
  assert.equal(h.pointFormat, 7);
  assert.equal(h.compressed, true);
  assert.equal(h.pointCount, 1);
  assert.equal(h.hasRgb, true);
  const p = createPointReader(h)(v, o, {});
  assert.ok(Math.abs(p.x - 650123.45) < 1e-6 && Math.abs(p.y - 6859995) < 1e-6 && Math.abs(p.z - 43.21) < 1e-6);
  assert.equal(p.intensity, 777);
  assert.equal(p.returnNumber, 2);
  assert.equal(p.numberOfReturns, 5);
  assert.equal(p.classification, 66);
  assert.deepEqual([p.r, p.g, p.b], [1000, 2000, 3000]);
});
