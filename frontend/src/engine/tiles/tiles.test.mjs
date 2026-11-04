// Tests des modules purs du moteur de tuiles. Lancer : npm test (utilise node:test, aucune dépendance).
import test from 'node:test';
import assert from 'node:assert/strict';
import { childrenOf, fillTemplate, lonLatToXYZ, parentOf, rowToLat, tileBounds, tileKey, xyzToLonLat } from './mercator.js';
import { selectTiles } from './quadtree.js';
import { LruCache } from './lru.js';
import { TileLoader } from './tileLoader.js';
import { viewportBounds } from './viewport.js';

const FOV = (45 * Math.PI) / 180;
const camAt = (lon, lat, dist) => lonLatToXYZ(lon, lat, dist);
const view = (cam, extra = {}) => ({ cam, fovY: FOV, viewportH: 1000, ...extra });

test('mercator : emprise de la tuile mondiale et aller-retour lon/lat ↔ xyz', () => {
  const b = tileBounds(0, 0, 0);
  assert.equal(b.west, -180);
  assert.equal(b.east, 180);
  assert.ok(Math.abs(b.north - 85.0511287798066) < 1e-9);
  const [lo, la] = xyzToLonLat(lonLatToXYZ(2.35, 48.86, 3));
  assert.ok(Math.abs(lo - 2.35) < 1e-9 && Math.abs(la - 48.86) < 1e-9);
  assert.ok(Math.abs(rowToLat(1, 2)) < 1e-9); // l'équateur est au milieu de la grille
});

test('mercator : parents, enfants, clés et modèles d’URL', () => {
  assert.deepEqual(parentOf({ z: 3, x: 5, y: 2 }), { z: 2, x: 2, y: 1 });
  assert.equal(parentOf({ z: 0, x: 0, y: 0 }), null);
  const kids = childrenOf({ z: 2, x: 1, y: 3 });
  assert.equal(kids.length, 4);
  assert.ok(kids.every((k) => k.z === 3 && parentOf(k).x === 1 && parentOf(k).y === 3));
  assert.equal(tileKey(4, 5, 6), '4/5/6');
  assert.equal(fillTemplate('u/{z}/{y}/{x}', { z: 4, x: 5, y: 6 }), 'u/4/6/5');
});

test('quadtree : vue globale = peu de tuiles, pas de caméra dans la Terre', () => {
  assert.deepEqual(selectTiles(view([0, 0, 0.5])), []);
  const far = selectTiles(view(camAt(0, 0, 4)));
  assert.ok(far.length >= 1 && far.length <= 40, `tuiles: ${far.length}`);
  assert.ok(Math.max(...far.map((t) => t.z)) <= 3);
});

test('quadtree : seul l’hémisphère visible est demandé (horizon)', () => {
  const tiles = selectTiles(view(camAt(0, 0, 4)));
  const camDir = lonLatToXYZ(0, 0);
  const horizon = Math.acos(1 / 4);
  for (const t of tiles) {
    const b = tileBounds(t.z, t.x, t.y);
    const c = lonLatToXYZ((b.west + b.east) / 2, (b.north + b.south) / 2);
    const ang = Math.acos(camDir[0] * c[0] + camDir[1] * c[1] + camDir[2] * c[2]);
    assert.ok(ang < horizon + 1.6, `tuile ${tileKey(t.z, t.x, t.y)} derrière l’horizon`);
  }
});

test('quadtree : tuiles de 512 px jusqu’au zoom 22 à 15 m d’altitude', () => {
  const dir = lonLatToXYZ(2.0967, 48.9992);
  const inFrustum = (c, r) => Math.hypot(c[0] - dir[0], c[1] - dir[1], c[2] - dir[2]) < 3e-6 + r;
  const tiles = selectTiles(view(camAt(2.0967, 48.9992, 1 + 2.4e-6), { inFrustum }), { maxZoom: 22, maxTilePx: 1024 });
  assert.equal(Math.max(...tiles.map((t) => t.z)), 22);
  assert.ok(tiles.length <= 64, `tuiles: ${tiles.length}`);
});

test('quadtree : de près, le zoom monte autour du point survolé et reste borné', () => {
  const cam = camAt(2.3522, 48.8566, 1.00003);
  // Caméra qui regarde droit vers le bas : on ne garde que les tuiles proches de la verticale (disque de quelques km sous la caméra).
  const dir = lonLatToXYZ(2.3522, 48.8566);
  const inFrustum = (c, r) => Math.acos(Math.min(1, c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2])) < 0.0006 + r; // ≈ 4 km de rayon
  const tiles = selectTiles(view(cam, { inFrustum }), { maxZoom: 19 });
  const zMax = Math.max(...tiles.map((t) => t.z));
  assert.equal(zMax, 19);
  assert.ok(tiles.length <= 256);
  const first = tiles[0];
  const b = tileBounds(first.z, first.x, first.y);
  assert.ok(2.3522 >= b.west - 0.01 && 2.3522 <= b.east + 0.01 && 48.8566 >= b.south - 0.01 && 48.8566 <= b.north + 0.01);
});

test('quadtree : aucune tuile n’en recouvre une autre', () => {
  for (const cam of [camAt(10, 40, 1.5), camAt(-70, -20, 1.01), camAt(139.7, 35.7, 1.0005)]) {
    const tiles = selectTiles(view(cam));
    const keys = new Set(tiles.map((t) => tileKey(t.z, t.x, t.y)));
    for (const t of tiles) {
      let p = parentOf(t);
      while (p) { assert.ok(!keys.has(tileKey(p.z, p.x, p.y)), 'ancêtre et descendant sélectionnés'); p = parentOf(p); }
    }
  }
});

test('quadtree : le zoom diminue avec l’altitude', () => {
  const zAt = (d) => Math.max(...selectTiles(view(camAt(5, 45, d))).map((t) => t.z));
  assert.ok(zAt(1.0001) > zAt(1.01));
  assert.ok(zAt(1.01) > zAt(1.5));
  assert.ok(zAt(1.5) >= zAt(5));
});

test('quadtree : le filtre de champ de vision est appliqué', () => {
  const all = selectTiles(view(camAt(0, 0, 1.3)));
  const none = selectTiles(view(camAt(0, 0, 1.3), { inFrustum: () => false }));
  assert.ok(all.length > 0);
  assert.equal(none.length, 0);
});

test('lru : évince le moins récent et notifie', () => {
  const evicted = [];
  const c = new LruCache(2, (k) => evicted.push(k));
  c.set('a', 1); c.set('b', 2);
  c.get('a');          // a devient récent
  c.set('c', 3);       // b est évincé
  assert.deepEqual(evicted, ['b']);
  assert.ok(c.has('a') && c.has('c') && !c.has('b'));
  assert.equal(c.peek('a'), 1);
  c.delete('a');
  assert.deepEqual(evicted, ['b', 'a']);
  c.clear();
  assert.equal(c.size, 0);
});

test('loader : respecte la concurrence et la priorité', async () => {
  const loader = new TileLoader(2);
  let running = 0, peak = 0;
  const order = [];
  const job = (name) => async () => { running++; peak = Math.max(peak, running); order.push(name); await new Promise((r) => setTimeout(r, 10)); running--; return name; };
  const ps = [loader.load('lent1', 9, job('lent1')), loader.load('lent2', 9, job('lent2')),
    loader.load('loin', 50, job('loin')), loader.load('près', 1, job('près'))];
  assert.deepEqual(await Promise.all(ps), ['lent1', 'lent2', 'loin', 'près']);
  assert.equal(peak, 2);
  assert.deepEqual(order.slice(2), ['près', 'loin']); // la plus proche passe avant
});

test('loader : annule une demande en file, regroupe les doublons', async () => {
  const loader = new TileLoader(1);
  let calls = 0;
  const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); };
  const p1 = loader.load('a', 1, slow);
  const p1bis = loader.load('a', 1, slow);
  assert.equal(p1, p1bis);
  const p2 = loader.load('b', 2, slow);
  loader.cancel('b');
  await assert.rejects(p2, { name: 'AbortError' });
  await p1;
  assert.equal(calls, 1);
  assert.equal(loader.has('b'), false);
});

test('viewport : emprise centrée sur la caméra, limitée par l’horizon', () => {
  const near = viewportBounds(camAt(2.35, 48.86, 1.0005), FOV, 16 / 9);
  assert.ok(near.north > 48.86 && near.south < 48.86 && near.east > 2.35 && near.west < 2.35);
  assert.ok(near.north - near.south < 1);
  const far = viewportBounds(camAt(0, 0, 100), FOV, 16 / 9);
  assert.ok(far.north < 90.001 && far.north - far.south < 180);
  assert.equal(viewportBounds([0, 0, 0.5], FOV, 1), null);
});

test('géométrie : sommets sur la sphère au bon rayon, uv Mercator, faces tournées vers l’extérieur', async () => {
  const { buildTileGrid } = await import('./tileGeometry.js');
  for (const [z, x, y] of [[0, 0, 0], [3, 4, 2], [12, 2074, 1409], [19, 300000, 200000], [22, 2122000, 1440000]]) {
    const g = buildTileGrid(z, x, y);
    const c = g.center;
    // Sommets relatifs au centre (sphère unité) : centre + sommet retombe sur la sphère.
    for (let i = 0; i < g.positions.length; i += 3) {
      assert.ok(Math.abs(Math.hypot(g.positions[i] + c[0], g.positions[i + 1] + c[1], g.positions[i + 2] + c[2]) - 1) < 1e-6);
    }
    // Au zoom 22, les coordonnées relatives restent minuscules : pas de perte de précision en float32.
    if (z === 22) assert.ok(Math.max(...g.positions.map(Math.abs)) < 1e-5);
    assert.equal(g.uvs[0], 0); assert.equal(g.uvs[1], 1);                            // coin Nord-Ouest = (0, 1)
    assert.equal(g.uvs[g.uvs.length - 2], 1); assert.equal(g.uvs[g.uvs.length - 1], 0); // coin Sud-Est = (1, 0)
    // Chaque triangle a sa normale géométrique du même côté que la normale sortante de la sphère.
    for (let t = 0; t < g.indices.length; t += 3) {
      const [a, b, c] = [g.indices[t], g.indices[t + 1], g.indices[t + 2]].map((i) => [g.positions[i * 3] + g.center[0], g.positions[i * 3 + 1] + g.center[1], g.positions[i * 3 + 2] + g.center[2]]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      assert.ok(n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0, `face inversée (z=${z})`);
    }
  }
});

test('géométrie : les niveaux fins sont posés au-dessus des niveaux grossiers', async () => {
  const { tileRadius, levelGap } = await import('./tileGeometry.js');
  const { MIN_DISTANCE_WITH_TILES } = { MIN_DISTANCE_WITH_TILES: 1 + 2.4e-6 };
  for (const alt of [3, 1e-3, 4e-5, MIN_DISTANCE_WITH_TILES - 1]) {
    const gap = levelGap(alt);
    for (let z = 1; z <= 22; z++) assert.ok(tileRadius(z, gap) > tileRadius(z - 1, gap));
    // Toute la pile de niveaux reste sous la caméra (≤ 10 % de l’altitude, ou 2,3e-5 de loin).
    assert.ok(tileRadius(22, gap) - 1 <= Math.max(alt * 0.1, 2.4e-5), `alt ${alt}`);
  }
  assert.equal(levelGap(3), 1e-6); // de loin : comme avant
});

// ------------------------------------------------------------ Lune : découpage plate carrée (NASA Trek)
import { EQUIRECTANGULAR, MERCATOR, tileBoundsIn } from './projection.js';
import { buildTileGrid } from './tileGeometry.js';

test('plate carrée : grille 2^(z+1) × 2^z du pôle Nord au pôle Sud', () => {
  const P = EQUIRECTANGULAR;
  assert.equal(P.cols(0), 2); assert.equal(P.rows(0), 1);
  assert.equal(P.cols(8), 512); assert.equal(P.rows(8), 256);
  assert.deepEqual(tileBoundsIn(P, 0, 0, 0), { west: -180, east: 0, north: 90, south: -90 });
  assert.deepEqual(tileBoundsIn(P, 1, 3, 1), { west: 90, east: 180, north: 0, south: -90 });
  // Le Mercator reste inchangé pour la Terre.
  assert.deepEqual(tileBoundsIn(MERCATOR, 0, 0, 0), tileBounds(0, 0, 0));
});

test('plate carrée : vue globale = deux racines, rien derrière la Lune', () => {
  const tiles = selectTiles(view(camAt(0, 0, 4)), { projection: EQUIRECTANGULAR, maxZoom: 8 });
  assert.ok(tiles.length >= 1 && tiles.length <= 40, `tuiles: ${tiles.length}`);
  for (const t of tiles) {
    const b = tileBoundsIn(EQUIRECTANGULAR, t.z, t.x, t.y);
    assert.ok(b.east > -100 && b.west < 100, `tuile ${tileKey(t.z, t.x, t.y)} sur la face cachée`);
  }
});

test('plate carrée : de près, on atteint le niveau maximal (8) sous la caméra, pôles compris', () => {
  for (const [lon, lat] of [[-3.6, 26.1], [0, 89.5]]) {
    const dir = lonLatToXYZ(lon, lat);
    // Distance (corde) entre le centre de la tuile et le point visé, comparée au rayon de la sphère englobante.
    const inFrustum = (c, r) => Math.hypot(c[0] - dir[0], c[1] - dir[1], c[2] - dir[2]) < 0.01 + r;
    const tiles = selectTiles(view(camAt(lon, lat, 1.002), { inFrustum }), { projection: EQUIRECTANGULAR, maxZoom: 8 });
    assert.equal(Math.max(...tiles.map((t) => t.z)), 8);
    assert.ok(tiles.length <= 256);
    const b = tileBoundsIn(EQUIRECTANGULAR, tiles[0].z, tiles[0].x, tiles[0].y);
    assert.ok(lon >= b.west - 1 && lon <= b.east + 1 && lat >= b.south - 1 && lat <= b.north + 1);
  }
});

test('plate carrée : maillage d’une tuile posé à la bonne latitude, v=1 au Nord', () => {
  const g = buildTileGrid(1, 2, 0, EQUIRECTANGULAR); // 0°→90°E, 90°N→0°
  const abs = (i) => [g.positions[i] + g.center[0], g.positions[i + 1] + g.center[1], g.positions[i + 2] + g.center[2]];
  const [lo0, la0] = xyzToLonLat(abs(0));
  assert.ok(Math.abs(lo0) < 1e-6 && Math.abs(la0 - 90) < 1e-4);
  assert.equal(g.uvs[1], 1);
  const last = g.positions.length - 3;
  const [lo1, la1] = xyzToLonLat(abs(last));
  assert.ok(Math.abs(lo1 - 90) < 1e-6 && Math.abs(la1) < 1e-6);
});

// ------------------------------------------------------------ frontières des pays
import { buildBorderSegments, borderLift } from '../bordersGeometry.js';

test('frontières : segments sur la sphère, découpés finement, sans traverser l’antiméridien', () => {
  const seg = buildBorderSegments([[2, 49, 3, 49], [179.9, 0, -179.9, 0]]);
  // 1° découpé en pas de 0,25° → 4 segments de 2 points ; le saut ±180° est ignoré.
  assert.equal(seg.length, 4 * 2 * 3);
  for (let i = 0; i < seg.length; i += 3) assert.ok(Math.abs(Math.hypot(seg[i], seg[i + 1], seg[i + 2]) - 1) < 1e-6);
  const [lo, la] = xyzToLonLat([seg[0], seg[1], seg[2]]);
  assert.ok(Math.abs(lo - 2) < 1e-5 && Math.abs(la - 49) < 1e-5);
  // Toujours au-dessus des tuiles les plus fines (≈ 1 + 2e-5), borné de loin.
  assert.ok(borderLift(0) > 2e-5 && borderLift(10) === 2e-3);
});

// ------------------------------------------------------------ sur-zoom (ex. natif 19 → affiché 22)
import { nativeTile, OVERZOOM_LEVELS } from './overzoom.js';

test('sur-zoom : tuile ancêtre au niveau natif et portion de texture correspondante', () => {
  assert.equal(OVERZOOM_LEVELS, 3);
  assert.deepEqual(nativeTile({ z: 12, x: 5, y: 7 }, 19), { coord: { z: 12, x: 5, y: 7 }, rect: [0, 0, 1, 1] });
  // z22 → z19 : 8×8 sous-tuiles. (x=8·100+3, y=8·200+5) → ancêtre (100, 200), colonne 3, ligne 5 depuis le haut.
  const r = nativeTile({ z: 22, x: 803, y: 1605 }, 19);
  assert.deepEqual(r.coord, { z: 19, x: 100, y: 200 });
  assert.deepEqual(r.rect, [3 / 8, 1 - 6 / 8, 1 / 8, 1 / 8]);
  // Les 4 enfants d'une tuile couvrent exactement son carré uv, sans recouvrement.
  const kids = childrenOf({ z: 19, x: 10, y: 10 }).map((k) => nativeTile(k, 19).rect);
  const area = kids.reduce((s, q) => s + q[2] * q[3], 0);
  assert.equal(area, 1);
  assert.deepEqual(new Set(kids.map((q) => `${q[0]},${q[1]}`)), new Set(['0,0.5', '0.5,0.5', '0,0', '0.5,0']));
});

// ------------------------------------------------------------ méthode de globe numérique : SSE, prédiction, priorités, jupes
import { ancestorRect, CameraPredictor, coneTest, tilePriority } from './prefetch.js';

test('SSE : erreur à l’écran sous 2 px pour chaque tuile retenue (hors niveau maximal)', () => {
  const tiles = selectTiles(view(camAt(5, 45, 1.01)), { maxZoom: 19, maxTiles: 1e4 }); // sans plafond : seuil inchangé
  assert.ok(tiles.length > 0);
  for (const t of tiles) assert.ok(t.sse <= 2 + 1e-9 || t.z === 19, `SSE ${t.sse} au niveau ${t.z}`);
  // Seuil plus tolérant → moins de tuiles, moins fines.
  const loose = selectTiles(view(camAt(5, 45, 1.01)), { maxZoom: 19, maxSSE: 8, maxTiles: 1e4 });
  assert.ok(loose.length < tiles.length);
});

test('prédiction : position estimée = position + vitesse × Δt, jamais sous le sol', () => {
  const p = new CameraPredictor({ smoothing: 1 });
  const fwd = [-1, 0, 0];
  p.update([2, 0, 0], fwd, 0);
  p.update([2, 0.01, 0], fwd, 100); // 0,1 rayon/s vers +y
  const e = p.predict(1.5);
  assert.ok(Math.abs(e.cam[1] - 0.16) < 1e-9 && Math.abs(e.cam[0] - 2) < 1e-9);
  // Zoom rapide vers le sol : la caméra estimée s'arrête au quart de l'altitude actuelle.
  const z = new CameraPredictor({ smoothing: 1 });
  z.update([1.1, 0, 0], fwd, 0);
  z.update([1.05, 0, 0], fwd, 100);
  assert.ok(Math.hypot(...z.predict(1.5).cam) >= 1 + 0.05 * 0.25 - 1e-12);
  // Pause (onglet caché) : vitesses remises à zéro.
  z.update([1.05, 0, 0], fwd, 5000);
  assert.deepEqual(z.v, [0, 0, 0]);
});

test('cône élargi et priorité : centre de l’écran et niveaux grossiers d’abord', () => {
  const cam = [2, 0, 0], fwd = [-1, 0, 0];
  const cone = coneTest(cam, fwd, Math.PI / 3);
  assert.equal(cone([1, 0, 0], 0.01), true);
  assert.equal(cone([2, 0, -1], 0.01), false); // à 90° de la visée, au-delà de 60°
  const center = tilePriority({ z: 8, c: [1, 0, 0] }, cam, fwd, 8);
  const side = tilePriority({ z: 8, c: [0.9, 0.43, 0] }, cam, fwd, 8);
  const coarse = tilePriority({ z: 7, c: [0.9, 0.43, 0] }, cam, fwd, 8);
  assert.ok(center < side, 'le centre passe avant le bord');
  assert.ok(coarse < side, 'le niveau grossier passe avant le fin');
});

test('fondu : portion de l’ancêtre qui recouvre la tuile, sur-zoom compris', () => {
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 3, y: 2 }), [0.5, 0.5, 0.5, 0.5]);
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 2, y: 3 }), [0, 0, 0.5, 0.5]);
  // Ancêtre lui-même sur-zoomé (moitié haute-gauche de son image) → quart de cette moitié.
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 3, y: 2 }, [0, 0.5, 0.5, 0.5]), [0.25, 0.75, 0.25, 0.25]);
});

test('jupes : un pourtour enfoncé sous le bord, mêmes uv que le bord', () => {
  const plain = buildTileGrid(3, 5, 2, EQUIRECTANGULAR);
  const g = buildTileGrid(3, 5, 2, EQUIRECTANGULAR, { skirt: 0.01 });
  const grid = (g.nu + 1) * (g.nv + 1);
  assert.equal(g.skirtVertices, 2 * (g.nu + g.nv));
  assert.equal(g.indices.length, plain.indices.length + g.skirtVertices * 6);
  for (let n = 0; n < g.skirtVertices; n++) {
    const i = (grid + n) * 3;
    const r = Math.hypot(g.positions[i] + g.center[0], g.positions[i + 1] + g.center[1], g.positions[i + 2] + g.center[2]);
    assert.ok(Math.abs(r - 0.99) < 1e-6, `rayon ${r}`);
  }
  // Le premier sommet de jupe double le coin Nord-Ouest (uv 0,1).
  assert.deepEqual([g.uvs[grid * 2], g.uvs[grid * 2 + 1]], [0, 1]);
  assert.ok(Math.max(...g.indices) < grid + g.skirtVertices);
});

// ------------------------------------------------------------ modèle 3D NASA : calage par les uv
import { uvAlignment, uvToLonLat } from '../moonModelMath.js';
import { lonLatToXYZ as llx } from './mercator.js';

test('modèle 3D : orientation retrouvée à partir des seules coordonnées de texture', () => {
  // Sphère « glTF » typique (Y en haut, longitude 0 vers +Z), tournée d'un angle quelconque autour de Y.
  const a = 0.7;
  const samples = [];
  for (let i = 1; i < 30; i++) for (let j = 4; j < 16; j++) {
    const u = i / 30, v = j / 20;
    const [lon, lat] = uvToLonLat(u, v);
    const t = llx(lon, lat);                    // direction attendue dans le repère du moteur
    // repère du modèle = rotation de −a autour de Y, puis échelle 37 (rayon quelconque)
    const p = [37 * (Math.cos(a) * t[0] - Math.sin(a) * t[2]), 37 * t[1], 37 * (Math.sin(a) * t[0] + Math.cos(a) * t[2])];
    samples.push({ p, u, v });
  }
  const r = uvAlignment(samples);
  assert.ok(Math.abs(r.det - 1) < 1e-9 && r.rms < 1e-6, `det ${r.det}, rms ${r.rms}`);
  // Modèle en miroir (longitudes inversées) : symétrie détectée.
  const mirror = uvAlignment(samples.map((s) => ({ ...s, p: [s.p[0], s.p[1], -s.p[2]] })));
  assert.ok(mirror.det < 0 && mirror.rms < 1e-6);
});

// ------------------------------------------------------------ Lune en direct
import { moonState, orbiterMetrics, orbiterStateAt, eclToScene, MOON_RADIUS_KM } from '../moonLive.js';

test('Lune en direct : phase, distance, libration et point subsolaire', () => {
  const id = (v) => v;
  // Pleine lune : Soleil derrière la Terre ; repère sélénographique = repère de la scène, Terre vers +X.
  const s = moonState({ moonRel: [-60, 0, 0], moonHelio: [-23455, 0, 0], elongDeg: 180, toLocal: id });
  assert.ok(s.lit > 0.999 && s.phase === 'Pleine lune');
  assert.ok(Math.abs(s.distKm - 60 * 6371) < 1e-6 && Math.abs(s.lightSeconds - 1.275) < 0.01);
  assert.ok(Math.abs(s.libration.lon) < 1e-9 && Math.abs(s.subSolar.lon) < 1e-9);
  // Premier quartier : Soleil à 90°, moitié éclairée, Soleil au zénith à 90° de longitude.
  const q = moonState({ moonRel: [-60, 0, 0], moonHelio: [0, 0, 23455], elongDeg: 90, toLocal: id });
  assert.ok(Math.abs(q.lit - 0.5) < 1e-9 && q.phase === 'Premier quartier' && q.waxing);
  assert.ok(Math.abs(Math.abs(q.subSolar.lon) - 90) < 1e-9);
  assert.ok(Math.abs(q.ageDays - 29.530589 / 4) < 1e-9);
});

test('sondes : altitude, vitesse, période (vis-viva), visibilité de la Terre', () => {
  const r0 = MOON_RADIUS_KM + 100, vc = Math.sqrt(4902.8001 / r0); // orbite circulaire à 100 km (≈ LRO)
  const pts = [];
  for (let i = 0; i < 40; i++) {
    const t = i * 120000, w = (vc / r0) * (t / 1000);
    pts.push({ t, x: r0 * Math.cos(w), y: r0 * Math.sin(w), z: 0 });
  }
  const st = orbiterStateAt(pts, 20 * 120000 + 3000);
  const toEarth = eclToScene([1, 0, 0]);
  const m = orbiterMetrics(st, (v) => v, toEarth);
  assert.ok(Math.abs(m.altitudeKm - 100) < 0.5, `altitude ${m.altitudeKm}`);
  assert.ok(Math.abs(m.speedKmS - vc) < 0.01);
  assert.ok(Math.abs(m.periodMin - 117.8) < 1.5, `période ${m.periodMin}`);
  // Derrière la Lune vue de la Terre : masquée.
  assert.equal(orbiterMetrics({ r: [-r0, 0, 0], v: [0, vc, 0] }, (v) => v, toEarth).earthVisible, false);
  assert.equal(orbiterMetrics({ r: [r0, 0, 0], v: [0, vc, 0] }, (v) => v, toEarth).earthVisible, true);
  assert.equal(orbiterStateAt(pts, -1), null);
});

test('sondes : étiquette cachée quand la Lune est entre la caméra et la sonde', async () => {
  // moonOrbiters.js importe three : on teste la fonction géométrique seule, recopiée de façon indépendante.
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../moonOrbiters.js', import.meta.url), 'utf8'));
  const body = src.slice(src.indexOf('export function segmentHitsSphere'));
  const segmentHitsSphere = new Function(`${body.replace('export ', '')}; return segmentHitsSphere;`)();
  assert.equal(segmentHitsSphere([0, 0, 10], [0, 0, -1.1], 1), true);   // sonde derrière la Lune
  assert.equal(segmentHitsSphere([0, 0, 10], [0, 0, 1.1], 1), false);   // sonde devant
  assert.equal(segmentHitsSphere([0, 0, 10], [1.5, 0, -1], 1), false);  // à côté du disque
});

// ------------------------------------------------------------ Danuri / ShadowCam : mosaïques polaires
import { buildMosaicGrid, polarToLonLat } from '../shadowcamMath.js';

test('ShadowCam : stéréographique polaire et maillage centré sur le cratère', () => {
  const sp = { pole: 'south', lon0: 0, k0: 1, radius: 1737400 };
  const rho = 2 * 1737400 * Math.tan((0.2 * Math.PI) / 180);
  const [lon, lat] = polarToLonLat(rho * Math.sin((135 * Math.PI) / 180), rho * Math.cos((135 * Math.PI) / 180), sp);
  assert.ok(Math.abs(lon - 135) < 1e-9 && Math.abs(lat + 89.6) < 1e-9);
  // Mosaïque de 20 km centrée sur Shackleton (89,6° S, 135° E).
  const meta = { ...sp, width: 1000, height: 1000, resX: 20, resY: 20, originX: rho * Math.sin(2.356194) - 10000, originY: rho * Math.cos(2.356194) + 10000 };
  const g = buildMosaicGrid(meta, 8);
  const [clon, clat] = xyzToLonLat(g.center);
  assert.ok(Math.abs(clat + 89.6) < 0.01 && Math.abs(clon - 135) < 0.5, `centre ${clon} ${clat}`);
  assert.ok(Math.abs(g.radius - (Math.SQRT2 * 10000) / 1737400) < 2e-4);
  assert.equal(g.indices.length, 8 * 8 * 6);
  assert.deepEqual([g.uvs[0], g.uvs[1]], [0, 1]); // coin haut-gauche de l'image
  const np = polarToLonLat(0, -rho, { ...sp, pole: 'north' });
  assert.ok(Math.abs(np[1] - 89.6) < 1e-9 && Math.abs(np[0]) < 1e-9);
});
