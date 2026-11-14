// Tests des modules purs du moteur de tuiles. Lancer : npm test (utilise node:test, aucune dépendance).
// Importe test, le lanceur de tests de Node.
import test from 'node:test';
// Importe assert, les vérifications strictes de Node.
import assert from 'node:assert/strict';
// Importe les fonctions de la grille Mercator, depuis mercator.
import { childrenOf, fillTemplate, lonLatToXYZ, parentOf, rowToLat, tileBounds, tileKey, xyzToLonLat } from './mercator';
// Importe selectTiles, le choix des tuiles à afficher, depuis quadtree.
import { selectTiles } from './quadtree';
// Importe LruCache, le cache qui évince le moins récent, depuis lru.
import { LruCache } from './lru';
// Importe TileLoader, la file de chargement des tuiles, depuis tileLoader.
import { TileLoader } from './tileLoader';
// Importe viewportBounds, les limites géographiques de la vue, depuis viewport.
import { viewportBounds } from './viewport';

// Champ vertical des tests : 45°, en radians.
const FOV = (45 * Math.PI) / 180;
// camAt : la position d'une caméra au-dessus d'une longitude et d'une latitude, à une distance du centre.
const camAt = (lon, lat, dist) => lonLatToXYZ(lon, lat, dist);
// view : la vue d'une caméra, avec le champ, un écran de 1 000 px de haut et des options.
const view = (cam, extra = {}) => ({ cam, fovY: FOV, viewportH: 1000, ...extra });

// Test : l'emprise de la tuile mondiale et l'aller-retour entre longitude/latitude et position (début).
test('mercator : emprise de la tuile mondiale et aller-retour lon/lat ↔ xyz', () => {
  // Emprise de la tuile 0/0/0.
  const b = tileBounds(0, 0, 0);
  // Son bord ouest est à −180°.
  assert.equal(b.west, -180);
  // Son bord est à 180°.
  assert.equal(b.east, 180);
  // Son bord nord est à 85,0511287798066°.
  assert.ok(Math.abs(b.north - 85.0511287798066) < 1e-9);
  // Convertit Paris en position à la distance 3, puis revient en longitude et latitude.
  const [lo, la] = xyzToLonLat(lonLatToXYZ(2.35, 48.86, 3));
  // Les deux valeurs sont retrouvées à 1e-9 près.
  assert.ok(Math.abs(lo - 2.35) < 1e-9 && Math.abs(la - 48.86) < 1e-9);
  // La ligne 1 d'une grille de 2 lignes est à la latitude 0.
  assert.ok(Math.abs(rowToLat(1, 2)) < 1e-9); // l'équateur est au milieu de la grille
// Fin du test.
});

// Test : les parents, les enfants, les clés et les modèles d'adresse (début).
test('mercator : parents, enfants, clés et modèles d’URL', () => {
  // Le parent de la tuile 3/5/2 est la tuile 2/2/1.
  assert.deepEqual(parentOf({ z: 3, x: 5, y: 2 }), { z: 2, x: 2, y: 1 });
  // La tuile 0/0/0 n'a pas de parent.
  assert.equal(parentOf({ z: 0, x: 0, y: 0 }), null);
  // Enfants de la tuile 2/1/3.
  const kids = childrenOf({ z: 2, x: 1, y: 3 });
  // Ils sont quatre.
  assert.equal(kids.length, 4);
  // Tous au niveau 3, avec la tuile 2/1/3 pour parent.
  assert.ok(kids.every((k) => k.z === 3 && parentOf(k).x === 1 && parentOf(k).y === 3));
  // La clé de la tuile 4/5/6 est « 4/5/6 ».
  assert.equal(tileKey(4, 5, 6), '4/5/6');
  // Le modèle « u/{z}/{y}/{x} » donne « u/4/6/5 ».
  assert.equal(fillTemplate('u/{z}/{y}/{x}', { z: 4, x: 5, y: 6 }), 'u/4/6/5');
// Fin du test.
});

// Test : une vue globale demande peu de tuiles, et aucune avec la caméra dans l'astre (début).
test('quadtree : vue globale = peu de tuiles, pas de caméra dans la Terre', () => {
  // Caméra à 0,5 rayon du centre : aucune tuile.
  assert.deepEqual(selectTiles(view([0, 0, 0.5])), []);
  // Tuiles vues depuis 4 rayons.
  const far = selectTiles(view(camAt(0, 0, 4)));
  // Entre 1 et 40 tuiles.
  assert.ok(far.length >= 1 && far.length <= 40, `tuiles: ${far.length}`);
  // Aucune au-delà du niveau 3.
  assert.ok(Math.max(...far.map((t) => t.z)) <= 3);
// Fin du test.
});

// Test : seul l'hémisphère visible est demandé (début).
test('quadtree : seul l’hémisphère visible est demandé (horizon)', () => {
  // Tuiles vues depuis 4 rayons.
  const tiles = selectTiles(view(camAt(0, 0, 4)));
  // Direction de la caméra.
  const camDir = lonLatToXYZ(0, 0);
  // Angle de l'horizon vu de cette distance.
  const horizon = Math.acos(1 / 4);
  // Pour chaque tuile (début).
  for (const t of tiles) {
    // Son emprise.
    const b = tileBounds(t.z, t.x, t.y);
    // La direction de son centre.
    const c = lonLatToXYZ((b.west + b.east) / 2, (b.north + b.south) / 2);
    // Son angle avec la direction de la caméra.
    const ang = Math.acos(camDir[0] * c[0] + camDir[1] * c[1] + camDir[2] * c[2]);
    // Il ne dépasse pas l'horizon de plus de 1,6 radian.
    assert.ok(ang < horizon + 1.6, `tuile ${tileKey(t.z, t.x, t.y)} derrière l’horizon`);
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : des tuiles de 512 px jusqu'au niveau 22 à 15 m d'altitude (début).
test('quadtree : tuiles de 512 px jusqu’au zoom 22 à 15 m d’altitude', () => {
  // Direction du point survolé.
  const dir = lonLatToXYZ(2.0967, 48.9992);
  // inFrustum : ne garde que les tuiles proches de ce point.
  const inFrustum = (c, r) => Math.hypot(c[0] - dir[0], c[1] - dir[1], c[2] - dir[2]) < 3e-6 + r;
  // Tuiles vues depuis 2,4e-6 rayon d'altitude, jusqu'au niveau 22, avec 1 024 px au plus par tuile.
  const tiles = selectTiles(view(camAt(2.0967, 48.9992, 1 + 2.4e-6), { inFrustum }), { maxZoom: 22, maxTilePx: 1024 });
  // Le niveau le plus fin atteint est 22.
  assert.equal(Math.max(...tiles.map((t) => t.z)), 22);
  // 64 tuiles au plus.
  assert.ok(tiles.length <= 64, `tuiles: ${tiles.length}`);
// Fin du test.
});

// Test : de près, le niveau monte autour du point survolé et reste borné (début).
test('quadtree : de près, le zoom monte autour du point survolé et reste borné', () => {
  // Caméra au-dessus de Paris, à 3e-5 rayon d'altitude.
  const cam = camAt(2.3522, 48.8566, 1.00003);
  // Caméra qui regarde droit vers le bas : on ne garde que les tuiles proches de la verticale (disque de quelques km sous la caméra).
  // Direction de Paris.
  const dir = lonLatToXYZ(2.3522, 48.8566);
  // inFrustum : ne garde que les tuiles à moins de 0,0006 radian de la verticale.
  const inFrustum = (c, r) => Math.acos(Math.min(1, c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2])) < 0.0006 + r; // ≈ 4 km de rayon
  // Tuiles de cette vue, jusqu'au niveau 19.
  const tiles = selectTiles(view(cam, { inFrustum }), { maxZoom: 19 });
  // Niveau le plus fin atteint.
  const zMax = Math.max(...tiles.map((t) => t.z));
  // C'est 19.
  assert.equal(zMax, 19);
  // 256 tuiles au plus.
  assert.ok(tiles.length <= 256);
  // Première tuile.
  const first = tiles[0];
  // Son emprise.
  const b = tileBounds(first.z, first.x, first.y);
  // Elle contient Paris, à 0,01° près.
  assert.ok(2.3522 >= b.west - 0.01 && 2.3522 <= b.east + 0.01 && 48.8566 >= b.south - 0.01 && 48.8566 <= b.north + 0.01);
// Fin du test.
});

// Test : aucune tuile n'en recouvre une autre (début).
test('quadtree : aucune tuile n’en recouvre une autre', () => {
  // Pour trois caméras à des distances différentes (début).
  for (const cam of [camAt(10, 40, 1.5), camAt(-70, -20, 1.01), camAt(139.7, 35.7, 1.0005)]) {
    // Tuiles de la vue.
    const tiles = selectTiles(view(cam));
    // Leurs clés.
    const keys = new Set(tiles.map((t) => tileKey(t.z, t.x, t.y)));
    // Pour chaque tuile (début).
    for (const t of tiles) {
      // Son parent.
      let p = parentOf(t);
      // En remontant jusqu'à la racine : aucun ancêtre n'est aussi sélectionné.
      while (p) { assert.ok(!keys.has(tileKey(p.z, p.x, p.y)), 'ancêtre et descendant sélectionnés'); p = parentOf(p); }
    // Fin de la boucle des tuiles.
    }
  // Fin de la boucle des caméras.
  }
// Fin du test.
});

// Test : le niveau diminue quand l'altitude augmente (début).
test('quadtree : le zoom diminue avec l’altitude', () => {
  // zAt : le niveau le plus fin atteint à une distance donnée.
  const zAt = (d) => Math.max(...selectTiles(view(camAt(5, 45, d))).map((t) => t.z));
  // Plus fin à 1,0001 qu'à 1,01.
  assert.ok(zAt(1.0001) > zAt(1.01));
  // Plus fin à 1,01 qu'à 1,5.
  assert.ok(zAt(1.01) > zAt(1.5));
  // Au moins aussi fin à 1,5 qu'à 5.
  assert.ok(zAt(1.5) >= zAt(5));
// Fin du test.
});

// Test : le filtre du champ de vision est appliqué (début).
test('quadtree : le filtre de champ de vision est appliqué', () => {
  // Tuiles sans filtre.
  const all = selectTiles(view(camAt(0, 0, 1.3)));
  // Tuiles avec un filtre qui refuse tout.
  const none = selectTiles(view(camAt(0, 0, 1.3), { inFrustum: () => false }));
  // Sans filtre : il y en a.
  assert.ok(all.length > 0);
  // Avec le filtre : aucune.
  assert.equal(none.length, 0);
// Fin du test.
});

// Test : le cache évince le moins récent et le signale (début).
test('lru : évince le moins récent et notifie', () => {
  // Clés évincées.
  const evicted = [];
  // Cache de deux places, qui note chaque clé évincée.
  const c = new LruCache(2, (k) => evicted.push(k));
  // Range a, puis b.
  c.set('a', 1); c.set('b', 2);
  // Lit a.
  c.get('a');          // a devient récent
  // Range c.
  c.set('c', 3);       // b est évincé
  // Seul b a été évincé.
  assert.deepEqual(evicted, ['b']);
  // a et c sont présents, b ne l'est plus.
  assert.ok(c.has('a') && c.has('c') && !c.has('b'));
  // La valeur de a est 1.
  assert.equal(c.peek('a'), 1);
  // Supprime a.
  c.delete('a');
  // La suppression est signalée aussi.
  assert.deepEqual(evicted, ['b', 'a']);
  // Vide le cache.
  c.clear();
  // Il ne contient plus rien.
  assert.equal(c.size, 0);
// Fin du test.
});

// Test, asynchrone : la file respecte le nombre de chargements simultanés et la priorité (début).
test('loader : respecte la concurrence et la priorité', async () => {
  // File de deux chargements simultanés.
  const loader = new TileLoader(2);
  // Chargements en cours et leur maximum.
  let running = 0, peak = 0;
  // Ordre de démarrage.
  const order = [];
  // job : une tâche de 10 ms qui compte les chargements en cours et note son nom.
  const job = (name) => async () => { running++; peak = Math.max(peak, running); order.push(name); await new Promise((r) => setTimeout(r, 10)); running--; return name; };
  // Lance deux tâches lentes de priorité 9,
  const ps = [loader.load('lent1', 9, job('lent1')), loader.load('lent2', 9, job('lent2')),
    // puis une tâche lointaine (50) et une tâche proche (1).
    loader.load('loin', 50, job('loin')), loader.load('près', 1, job('près'))];
  // Chaque demande renvoie son propre résultat.
  assert.deepEqual(await Promise.all(ps), ['lent1', 'lent2', 'loin', 'près']);
  // Jamais plus de deux à la fois.
  assert.equal(peak, 2);
  // Après les deux premières, la proche démarre avant la lointaine.
  assert.deepEqual(order.slice(2), ['près', 'loin']); // la plus proche passe avant
// Fin du test.
});

// Test, asynchrone : une demande en file est annulée, les doublons sont regroupés (début).
test('loader : annule une demande en file, regroupe les doublons', async () => {
  // File d'un seul chargement à la fois.
  const loader = new TileLoader(1);
  // Nombre d'appels.
  let calls = 0;
  // slow : une tâche de 10 ms qui compte les appels.
  const slow = async () => { calls++; await new Promise((r) => setTimeout(r, 10)); };
  // Demande a.
  const p1 = loader.load('a', 1, slow);
  // La même demande une seconde fois.
  const p1bis = loader.load('a', 1, slow);
  // C'est la même promesse.
  assert.equal(p1, p1bis);
  // Demande b, en attente.
  const p2 = loader.load('b', 2, slow);
  // L'annule.
  loader.cancel('b');
  // Sa promesse est rejetée avec une erreur d'abandon.
  await assert.rejects(p2, { name: 'AbortError' });
  // Attend a.
  await p1;
  // Un seul appel a eu lieu.
  assert.equal(calls, 1);
  // b n'est plus dans la file.
  assert.equal(loader.has('b'), false);
// Fin du test.
});

// Test : l'emprise de la vue est centrée sur la caméra et limitée par l'horizon (début).
test('viewport : emprise centrée sur la caméra, limitée par l’horizon', () => {
  // Emprise d'une vue proche, au-dessus de Paris, en 16/9.
  const near = viewportBounds(camAt(2.35, 48.86, 1.0005), FOV, 16 / 9);
  // Paris est à l'intérieur.
  assert.ok(near.north > 48.86 && near.south < 48.86 && near.east > 2.35 && near.west < 2.35);
  // Elle couvre moins de 1° de latitude.
  assert.ok(near.north - near.south < 1);
  // Emprise d'une vue à 100 rayons.
  const far = viewportBounds(camAt(0, 0, 100), FOV, 16 / 9);
  // Elle ne dépasse pas le pôle et couvre moins de 180° de latitude.
  assert.ok(far.north < 90.001 && far.north - far.south < 180);
  // Caméra dans l'astre : aucune emprise.
  assert.equal(viewportBounds([0, 0, 0.5], FOV, 1), null);
// Fin du test.
});

// Test, asynchrone : les sommets sont sur la sphère, les uv suivent Mercator, les faces regardent dehors (début).
test('géométrie : sommets sur la sphère au bon rayon, uv Mercator, faces tournées vers l’extérieur', async () => {
  // Importe buildTileGrid, le maillage d'une tuile.
  const { buildTileGrid } = await import('./tileGeometry');
  // Pour cinq tuiles, du niveau 0 au niveau 22 (début).
  for (const [z, x, y] of [[0, 0, 0], [3, 4, 2], [12, 2074, 1409], [19, 300000, 200000], [22, 2122000, 1440000]]) {
    // Son maillage.
    const g = buildTileGrid(z, x, y);
    // Son centre.
    const c = g.center;
    // Sommets relatifs au centre (sphère unité) : centre + sommet retombe sur la sphère.
    // Pour chaque sommet (début).
    for (let i = 0; i < g.positions.length; i += 3) {
      // Centre + sommet est à la distance 1 du centre de l'astre, à 1e-6 près.
      assert.ok(Math.abs(Math.hypot(g.positions[i] + c[0], g.positions[i + 1] + c[1], g.positions[i + 2] + c[2]) - 1) < 1e-6);
    // Fin de la boucle.
    }
    // Au zoom 22, les coordonnées relatives restent minuscules : pas de perte de précision en float32.
    // Au niveau 22 : les coordonnées relatives restent sous 1e-5.
    if (z === 22) assert.ok(Math.max(...g.positions.map(Math.abs)) < 1e-5);
    // Les uv du premier sommet sont (0, 1).
    assert.equal(g.uvs[0], 0); assert.equal(g.uvs[1], 1);                            // coin Nord-Ouest = (0, 1)
    // Ceux du dernier sont (1, 0).
    assert.equal(g.uvs[g.uvs.length - 2], 1); assert.equal(g.uvs[g.uvs.length - 1], 0); // coin Sud-Est = (1, 0)
    // Chaque triangle a sa normale géométrique du même côté que la normale sortante de la sphère.
    // Pour chaque triangle (début).
    for (let t = 0; t < g.indices.length; t += 3) {
      // Ses trois sommets, en position absolue.
      const [a, b, c] = [g.indices[t], g.indices[t + 1], g.indices[t + 2]].map((i) => [g.positions[i * 3] + g.center[0], g.positions[i * 3 + 1] + g.center[1], g.positions[i * 3 + 2] + g.center[2]]);
      // Ses deux côtés partant du premier sommet.
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      // Sa normale : leur produit vectoriel.
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      // Son milieu.
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      // La normale pointe du même côté que le milieu : vers l'extérieur.
      assert.ok(n[0] * m[0] + n[1] * m[1] + n[2] * m[2] > 0, `face inversée (z=${z})`);
    // Fin de la boucle des triangles.
    }
  // Fin de la boucle des tuiles.
  }
// Fin du test.
});

// Test, asynchrone : les niveaux fins sont posés au-dessus des niveaux grossiers (début).
test('géométrie : les niveaux fins sont posés au-dessus des niveaux grossiers', async () => {
  // Importe tileRadius et levelGap, le rayon d'un niveau et l'écart entre niveaux.
  const { tileRadius, levelGap } = await import('./tileGeometry');
  // Distance minimale de la caméra retenue pour ce test : 1 + 2,4e-6.
  const { MIN_DISTANCE_WITH_TILES } = { MIN_DISTANCE_WITH_TILES: 1 + 2.4e-6 };
  // Pour quatre altitudes, de 3 rayons à la plus basse (début).
  for (const alt of [3, 1e-3, 4e-5, MIN_DISTANCE_WITH_TILES - 1]) {
    // Écart entre niveaux à cette altitude.
    const gap = levelGap(alt);
    // Du niveau 1 au niveau 22 : chaque niveau est plus haut que le précédent.
    for (let z = 1; z <= 22; z++) assert.ok(tileRadius(z, gap) > tileRadius(z - 1, gap));
    // Toute la pile de niveaux reste sous la caméra (≤ 10 % de l’altitude, ou 2,3e-5 de loin).
    // Le niveau 22 dépasse le sol d'au plus 10 % de l'altitude, ou de 2,4e-5.
    assert.ok(tileRadius(22, gap) - 1 <= Math.max(alt * 0.1, 2.4e-5), `alt ${alt}`);
  // Fin de la boucle.
  }
  // À 3 rayons, l'écart est 1e-6.
  assert.equal(levelGap(3), 1e-6); // de loin : comme avant
// Fin du test.
});

// ------------------------------------------------------------ Lune : découpage plate carrée (NASA Trek)
// Importe les deux projections et l'emprise d'une tuile selon la projection, depuis projection.
import { EQUIRECTANGULAR, MERCATOR, tileBoundsIn } from './projection';
// Importe buildTileGrid, le maillage d'une tuile, depuis tileGeometry.
import { buildTileGrid } from './tileGeometry';

// Test : la grille plate carrée compte 2^(z+1) colonnes et 2^z lignes, d'un pôle à l'autre (début).
test('plate carrée : grille 2^(z+1) × 2^z du pôle Nord au pôle Sud', () => {
  // La projection plate carrée.
  const P = EQUIRECTANGULAR;
  // Niveau 0 : 2 colonnes et 1 ligne.
  assert.equal(P.cols(0), 2); assert.equal(P.rows(0), 1);
  // Niveau 8 : 512 colonnes et 256 lignes.
  assert.equal(P.cols(8), 512); assert.equal(P.rows(8), 256);
  // La tuile 0/0/0 couvre de −180° à 0° et de 90° à −90°.
  assert.deepEqual(tileBoundsIn(P, 0, 0, 0), { west: -180, east: 0, north: 90, south: -90 });
  // La tuile 1/3/1 couvre de 90° à 180° et de 0° à −90°.
  assert.deepEqual(tileBoundsIn(P, 1, 3, 1), { west: 90, east: 180, north: 0, south: -90 });
  // Le Mercator reste inchangé pour la Terre.
  // En Mercator, l'emprise est la même que celle de tileBounds.
  assert.deepEqual(tileBoundsIn(MERCATOR, 0, 0, 0), tileBounds(0, 0, 0));
// Fin du test.
});

// Test : en plate carrée, une vue globale part de deux racines et ne demande rien derrière l'astre (début).
test('plate carrée : vue globale = deux racines, rien derrière la Lune', () => {
  // Tuiles vues depuis 4 rayons, jusqu'au niveau 8.
  const tiles = selectTiles(view(camAt(0, 0, 4)), { projection: EQUIRECTANGULAR, maxZoom: 8 });
  // Entre 1 et 40 tuiles.
  assert.ok(tiles.length >= 1 && tiles.length <= 40, `tuiles: ${tiles.length}`);
  // Pour chaque tuile (début).
  for (const t of tiles) {
    // Son emprise.
    const b = tileBoundsIn(EQUIRECTANGULAR, t.z, t.x, t.y);
    // Elle touche l'intervalle de −100° à 100° de longitude.
    assert.ok(b.east > -100 && b.west < 100, `tuile ${tileKey(t.z, t.x, t.y)} sur la face cachée`);
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : en plate carrée, de près, le niveau 8 est atteint sous la caméra, pôles compris (début).
test('plate carrée : de près, on atteint le niveau maximal (8) sous la caméra, pôles compris', () => {
  // Pour deux lieux, dont un près du pôle Nord (début).
  for (const [lon, lat] of [[-3.6, 26.1], [0, 89.5]]) {
    // Direction du lieu.
    const dir = lonLatToXYZ(lon, lat);
    // Distance (corde) entre le centre de la tuile et le point visé, comparée au rayon de la sphère englobante.
    // inFrustum : ne garde que les tuiles proches du lieu.
    const inFrustum = (c, r) => Math.hypot(c[0] - dir[0], c[1] - dir[1], c[2] - dir[2]) < 0.01 + r;
    // Tuiles vues depuis 0,002 rayon d'altitude, jusqu'au niveau 8.
    const tiles = selectTiles(view(camAt(lon, lat, 1.002), { inFrustum }), { projection: EQUIRECTANGULAR, maxZoom: 8 });
    // Le niveau le plus fin atteint est 8.
    assert.equal(Math.max(...tiles.map((t) => t.z)), 8);
    // 256 tuiles au plus.
    assert.ok(tiles.length <= 256);
    // Emprise de la première tuile.
    const b = tileBoundsIn(EQUIRECTANGULAR, tiles[0].z, tiles[0].x, tiles[0].y);
    // Elle contient le lieu, à 1° près.
    assert.ok(lon >= b.west - 1 && lon <= b.east + 1 && lat >= b.south - 1 && lat <= b.north + 1);
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : en plate carrée, le maillage est posé à la bonne latitude, avec v = 1 au Nord (début).
test('plate carrée : maillage d’une tuile posé à la bonne latitude, v=1 au Nord', () => {
  // Maillage de la tuile 1/2/0.
  const g = buildTileGrid(1, 2, 0, EQUIRECTANGULAR); // 0°→90°E, 90°N→0°
  // abs : la position absolue d'un sommet.
  const abs = (i) => [g.positions[i] + g.center[0], g.positions[i + 1] + g.center[1], g.positions[i + 2] + g.center[2]];
  // Longitude et latitude du premier sommet.
  const [lo0, la0] = xyzToLonLat(abs(0));
  // Il est à 0° de longitude et 90° de latitude.
  assert.ok(Math.abs(lo0) < 1e-6 && Math.abs(la0 - 90) < 1e-4);
  // Son v vaut 1.
  assert.equal(g.uvs[1], 1);
  // Indice du dernier sommet.
  const last = g.positions.length - 3;
  // Sa longitude et sa latitude.
  const [lo1, la1] = xyzToLonLat(abs(last));
  // Il est à 90° de longitude et 0° de latitude.
  assert.ok(Math.abs(lo1 - 90) < 1e-6 && Math.abs(la1) < 1e-6);
// Fin du test.
});

// ------------------------------------------------------------ frontières des pays
// Importe buildBorderSegments et borderLift, les segments des frontières et leur hauteur, depuis bordersGeometry.
import { buildBorderSegments, borderLift } from '../bordersGeometry';

// Test : les frontières sont sur la sphère, découpées finement, sans traverser l'antiméridien (début).
test('frontières : segments sur la sphère, découpés finement, sans traverser l’antiméridien', () => {
  // Segments de deux traits : un de 1° de long, un qui saute de 179,9° à −179,9°.
  const seg = buildBorderSegments([[2, 49, 3, 49], [179.9, 0, -179.9, 0]]);
  // 1° découpé en pas de 0,25° → 4 segments de 2 points ; le saut ±180° est ignoré.
  // 4 segments de 2 points de 3 coordonnées.
  assert.equal(seg.length, 4 * 2 * 3);
  // Chaque point est à la distance 1 du centre, à 1e-6 près.
  for (let i = 0; i < seg.length; i += 3) assert.ok(Math.abs(Math.hypot(seg[i], seg[i + 1], seg[i + 2]) - 1) < 1e-6);
  // Longitude et latitude du premier point.
  const [lo, la] = xyzToLonLat([seg[0], seg[1], seg[2]]);
  // Il est à 2° et 49°.
  assert.ok(Math.abs(lo - 2) < 1e-5 && Math.abs(la - 49) < 1e-5);
  // Toujours au-dessus des tuiles les plus fines (≈ 1 + 2e-5), borné de loin.
  // La hauteur dépasse 2e-5 au sol et vaut 2e-3 de loin.
  assert.ok(borderLift(0) > 2e-5 && borderLift(10) === 2e-3);
// Fin du test.
});

// ------------------------------------------------------------ sur-zoom (ex. natif 19 → affiché 22)
// Importe nativeTile et OVERZOOM_LEVELS, la tuile native d'une tuile sur-zoomée et le nombre de niveaux, depuis overzoom.
import { nativeTile, OVERZOOM_LEVELS } from './overzoom';

// Test : la tuile ancêtre au niveau natif et la portion de texture correspondante (début).
test('sur-zoom : tuile ancêtre au niveau natif et portion de texture correspondante', () => {
  // Trois niveaux de sur-zoom.
  assert.equal(OVERZOOM_LEVELS, 3);
  // Sous le niveau natif : la tuile elle-même, avec toute sa texture.
  assert.deepEqual(nativeTile({ z: 12, x: 5, y: 7 }, 19), { coord: { z: 12, x: 5, y: 7 }, rect: [0, 0, 1, 1] });
  // z22 → z19 : 8×8 sous-tuiles. (x=8·100+3, y=8·200+5) → ancêtre (100, 200), colonne 3, ligne 5 depuis le haut.
  // Tuile 22/803/1605, pour un niveau natif de 19.
  const r = nativeTile({ z: 22, x: 803, y: 1605 }, 19);
  // Son ancêtre est la tuile 19/100/200.
  assert.deepEqual(r.coord, { z: 19, x: 100, y: 200 });
  // Sa portion : colonne 3 et ligne 5 depuis le haut, sur 8 × 8.
  assert.deepEqual(r.rect, [3 / 8, 1 - 6 / 8, 1 / 8, 1 / 8]);
  // Les 4 enfants d'une tuile couvrent exactement son carré uv, sans recouvrement.
  // Portions des quatre enfants d'une tuile de niveau 19.
  const kids = childrenOf({ z: 19, x: 10, y: 10 }).map((k) => nativeTile(k, 19).rect);
  // Somme de leurs surfaces.
  const area = kids.reduce((s, q) => s + q[2] * q[3], 0);
  // Elle vaut 1.
  assert.equal(area, 1);
  // Leurs coins sont (0 ; 0,5), (0,5 ; 0,5), (0 ; 0) et (0,5 ; 0).
  assert.deepEqual(new Set(kids.map((q) => `${q[0]},${q[1]}`)), new Set(['0,0.5', '0.5,0.5', '0,0', '0.5,0']));
// Fin du test.
});

// ------------------------------------------------------------ méthode de globe numérique : SSE, prédiction, priorités, jupes
// Importe les fonctions du préchargement prédictif, depuis prefetch.
import { ancestorRect, CameraPredictor, coneTest, tilePriority, ZoomWatch } from './prefetch';

// Test : l'erreur à l'écran reste sous 2 px pour chaque tuile retenue, hors niveau maximal (début).
test('SSE : erreur à l’écran sous 2 px pour chaque tuile retenue (hors niveau maximal)', () => {
  // Tuiles vues depuis 1,01 rayon, jusqu'au niveau 19, sans plafond de nombre.
  const tiles = selectTiles(view(camAt(5, 45, 1.01)), { maxZoom: 19, maxTiles: 1e4 }); // sans plafond : seuil inchangé
  // Il y en a.
  assert.ok(tiles.length > 0);
  // Chaque tuile a une erreur d'au plus 2 px, ou est au niveau 19.
  for (const t of tiles) assert.ok(t.sse <= 2 + 1e-9 || t.z === 19, `SSE ${t.sse} au niveau ${t.z}`);
  // Seuil plus tolérant → moins de tuiles, moins fines.
  // Les mêmes, avec un seuil de 8 px.
  const loose = selectTiles(view(camAt(5, 45, 1.01)), { maxZoom: 19, maxSSE: 8, maxTiles: 1e4 });
  // Elles sont moins nombreuses.
  assert.ok(loose.length < tiles.length);
// Fin du test.
});

// Test : la position estimée vaut position + vitesse × durée, jamais sous le sol (début).
test('prédiction : position estimée = position + vitesse × Δt, jamais sous le sol', () => {
  // Prédicteur sans lissage.
  const p = new CameraPredictor({ smoothing: 1 });
  // Direction de visée.
  const fwd = [-1, 0, 0];
  // Première position, à l'instant 0.
  p.update([2, 0, 0], fwd, 0);
  // Deuxième position, 100 ms plus tard.
  p.update([2, 0.01, 0], fwd, 100); // 0,1 rayon/s vers +y
  // Position estimée 1,5 s plus tard.
  const e = p.predict(1.5);
  // y vaut 0,16 et x reste à 2.
  assert.ok(Math.abs(e.cam[1] - 0.16) < 1e-9 && Math.abs(e.cam[0] - 2) < 1e-9);
  // Zoom rapide vers le sol : la caméra estimée s'arrête au quart de l'altitude actuelle.
  // Autre prédicteur.
  const z = new CameraPredictor({ smoothing: 1 });
  // Caméra à 0,1 rayon d'altitude.
  z.update([1.1, 0, 0], fwd, 0);
  // Puis à 0,05, 100 ms plus tard.
  z.update([1.05, 0, 0], fwd, 100);
  // La position estimée reste à au moins un quart de l'altitude actuelle.
  assert.ok(Math.hypot(...z.predict(1.5).cam) >= 1 + 0.05 * 0.25 - 1e-12);
  // Pause (onglet caché) : vitesses remises à zéro.
  // Nouvelle position 4,9 s plus tard.
  z.update([1.05, 0, 0], fwd, 5000);
  // La vitesse est remise à zéro.
  assert.deepEqual(z.v, [0, 0, 0]);
// Fin du test.
});

// Test : un zoom est détecté quand l'altitude change, tenu 400 ms, pas à altitude constante (début).
test('zoom en cours : détecté quand l’altitude change, tenu 400 ms, pas pendant un déplacement à altitude constante', () => {
  // Détecteur de zoom.
  const w = new ZoomWatch();
  // Première image : pas de zoom.
  assert.equal(w.update([2, 0, 0], 0), false);          // première image : rien à comparer
  // L'altitude baisse : zoom.
  assert.equal(w.update([1.9, 0, 0], 16), true);        // l'altitude baisse de 10 % : zoom
  // Immobile à 300 ms : encore un zoom.
  assert.equal(w.update([1.9, 0, 0], 300), true);       // immobile, mais encore dans les 400 ms
  // À 500 ms : terminé.
  assert.equal(w.update([1.9, 0, 0], 500), false);      // zoom terminé
  // Cosinus et sinus de 0,1 radian.
  const c = Math.cos(0.1), s = Math.sin(0.1);
  // Déplacement à la même altitude : pas de zoom.
  assert.equal(w.update([1.9 * c, 1.9 * s, 0], 516), false); // déplacement autour de l'astre, même altitude
// Fin du test.
});

// Test : le cône élargi, et la priorité au centre de l'écran et aux niveaux grossiers (début).
test('cône élargi et priorité : centre de l’écran et niveaux grossiers d’abord', () => {
  // Caméra à 2 rayons, qui vise le centre.
  const cam = [2, 0, 0], fwd = [-1, 0, 0];
  // Cône de 60° autour de la visée.
  const cone = coneTest(cam, fwd, Math.PI / 3);
  // Un point dans l'axe est dedans.
  assert.equal(cone([1, 0, 0], 0.01), true);
  // Un point à 90° de la visée est dehors.
  assert.equal(cone([2, 0, -1], 0.01), false); // à 90° de la visée, au-delà de 60°
  // Priorité d'une tuile de niveau 8 au centre.
  const center = tilePriority({ z: 8, c: [1, 0, 0] }, cam, fwd, 8);
  // Priorité d'une tuile de niveau 8 sur le côté.
  const side = tilePriority({ z: 8, c: [0.9, 0.43, 0] }, cam, fwd, 8);
  // Priorité d'une tuile de niveau 7 au même endroit.
  const coarse = tilePriority({ z: 7, c: [0.9, 0.43, 0] }, cam, fwd, 8);
  // Le centre passe avant le côté.
  assert.ok(center < side, 'le centre passe avant le bord');
  // Le niveau 7 passe avant le niveau 8.
  assert.ok(coarse < side, 'le niveau grossier passe avant le fin');
// Fin du test.
});

// Test : la portion de l'ancêtre qui recouvre la tuile, sur-zoom compris (début).
test('fondu : portion de l’ancêtre qui recouvre la tuile, sur-zoom compris', () => {
  // L'enfant 4/3/2 de la tuile 3/1/1 en occupe le quart en (0,5 ; 0,5).
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 3, y: 2 }), [0.5, 0.5, 0.5, 0.5]);
  // L'enfant 4/2/3 en occupe le quart en (0 ; 0).
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 2, y: 3 }), [0, 0, 0.5, 0.5]);
  // Ancêtre lui-même sur-zoomé (moitié haute-gauche de son image) → quart de cette moitié.
  // Avec un ancêtre qui n'utilise que la moitié haute-gauche de son image : le quart de cette moitié.
  assert.deepEqual(ancestorRect({ z: 3, x: 1, y: 1 }, { z: 4, x: 3, y: 2 }, [0, 0.5, 0.5, 0.5]), [0.25, 0.75, 0.25, 0.25]);
// Fin du test.
});

// Test : les jupes forment un pourtour enfoncé sous le bord, avec les mêmes uv (début).
test('jupes : un pourtour enfoncé sous le bord, mêmes uv que le bord', () => {
  // Maillage sans jupe.
  const plain = buildTileGrid(3, 5, 2, EQUIRECTANGULAR);
  // Maillage avec une jupe de 0,01.
  const g = buildTileGrid(3, 5, 2, EQUIRECTANGULAR, { skirt: 0.01 });
  // Nombre de sommets de la grille.
  const grid = (g.nu + 1) * (g.nv + 1);
  // La jupe compte 2 × (nu + nv) sommets.
  assert.equal(g.skirtVertices, 2 * (g.nu + g.nv));
  // Elle ajoute 6 indices par sommet.
  assert.equal(g.indices.length, plain.indices.length + g.skirtVertices * 6);
  // Pour chaque sommet de jupe (début).
  for (let n = 0; n < g.skirtVertices; n++) {
    // Son indice dans les positions.
    const i = (grid + n) * 3;
    // Sa distance au centre de l'astre.
    const r = Math.hypot(g.positions[i] + g.center[0], g.positions[i + 1] + g.center[1], g.positions[i + 2] + g.center[2]);
    // Elle vaut 0,99.
    assert.ok(Math.abs(r - 0.99) < 1e-6, `rayon ${r}`);
  // Fin de la boucle.
  }
  // Le premier sommet de jupe double le coin Nord-Ouest (uv 0,1).
  // Les uv du premier sommet de jupe sont (0, 1).
  assert.deepEqual([g.uvs[grid * 2], g.uvs[grid * 2 + 1]], [0, 1]);
  // Aucun indice ne dépasse le nombre de sommets.
  assert.ok(Math.max(...g.indices) < grid + g.skirtVertices);
// Fin du test.
});

// ------------------------------------------------------------ modèle 3D NASA : calage par les uv
// Importe uvAlignment et uvToLonLat, le calage par les uv et leur conversion, depuis moonModelMath.
import { uvAlignment, uvToLonLat } from '../moonModelMath';
// Importe lonLatToXYZ sous le nom llx, depuis mercator.
import { lonLatToXYZ as llx } from './mercator';

// Test : l'orientation d'un modèle 3D est retrouvée à partir des seules coordonnées de texture (début).
test('modèle 3D : orientation retrouvée à partir des seules coordonnées de texture', () => {
  // Sphère « glTF » typique (Y en haut, longitude 0 vers +Z), tournée d'un angle quelconque autour de Y.
  // Angle de rotation du modèle.
  const a = 0.7;
  // Échantillons.
  const samples = [];
  // Pour une grille de 29 × 12 points (début).
  for (let i = 1; i < 30; i++) for (let j = 4; j < 16; j++) {
    // Leurs coordonnées de texture.
    const u = i / 30, v = j / 20;
    // Longitude et latitude correspondantes.
    const [lon, lat] = uvToLonLat(u, v);
    // Direction attendue dans le repère du moteur.
    const t = llx(lon, lat);                    // direction attendue dans le repère du moteur
    // repère du modèle = rotation de −a autour de Y, puis échelle 37 (rayon quelconque)
    // Position dans le repère du modèle : tournée autour de Y et agrandie 37 fois.
    const p = [37 * (Math.cos(a) * t[0] - Math.sin(a) * t[2]), 37 * t[1], 37 * (Math.sin(a) * t[0] + Math.cos(a) * t[2])];
    // Ajoute l'échantillon.
    samples.push({ p, u, v });
  // Fin de la boucle.
  }
  // Calage trouvé.
  const r = uvAlignment(samples);
  // C'est une rotation (déterminant 1), avec un écart sous 1e-6.
  assert.ok(Math.abs(r.det - 1) < 1e-9 && r.rms < 1e-6, `det ${r.det}, rms ${r.rms}`);
  // Modèle en miroir (longitudes inversées) : symétrie détectée.
  // Calage du modèle en miroir.
  const mirror = uvAlignment(samples.map((s) => ({ ...s, p: [s.p[0], s.p[1], -s.p[2]] })));
  // Son déterminant est négatif, avec un écart sous 1e-6.
  assert.ok(mirror.det < 0 && mirror.rms < 1e-6);
// Fin du test.
});

// ------------------------------------------------------------ Lune en direct
// Importe les fonctions et le rayon de la Lune en direct, depuis moonLive.
import { moonState, orbiterMetrics, orbiterStateAt, eclToScene, MOON_RADIUS_KM } from '../moonLive';

// Test : la phase, la distance, la libration et le point subsolaire de la Lune (début).
test('Lune en direct : phase, distance, libration et point subsolaire', () => {
  // id : renvoie le vecteur tel quel.
  const id = (v) => v;
  // Pleine lune : Soleil derrière la Terre ; repère sélénographique = repère de la scène, Terre vers +X.
  // État de la Lune à 180° d'élongation.
  const s = moonState({ moonRel: [-60, 0, 0], moonHelio: [-23455, 0, 0], elongDeg: 180, toLocal: id });
  // Presque entièrement éclairée : « Pleine lune ».
  assert.ok(s.lit > 0.999 && s.phase === 'Pleine lune');
  // Distance de 60 rayons terrestres, soit 1,275 seconde de lumière.
  assert.ok(Math.abs(s.distKm - 60 * 6371) < 1e-6 && Math.abs(s.lightSeconds - 1.275) < 0.01);
  // Libration et point subsolaire à 0° de longitude.
  assert.ok(Math.abs(s.libration.lon) < 1e-9 && Math.abs(s.subSolar.lon) < 1e-9);
  // Premier quartier : Soleil à 90°, moitié éclairée, Soleil au zénith à 90° de longitude.
  // État de la Lune à 90° d'élongation.
  const q = moonState({ moonRel: [-60, 0, 0], moonHelio: [0, 0, 23455], elongDeg: 90, toLocal: id });
  // À moitié éclairée, « Premier quartier », croissante.
  assert.ok(Math.abs(q.lit - 0.5) < 1e-9 && q.phase === 'Premier quartier' && q.waxing);
  // Point subsolaire à 90° de longitude.
  assert.ok(Math.abs(Math.abs(q.subSolar.lon) - 90) < 1e-9);
  // Âge : un quart de lunaison.
  assert.ok(Math.abs(q.ageDays - 29.530589 / 4) < 1e-9);
// Fin du test.
});

// Test : l'altitude, la vitesse, la période et la visibilité de la Terre d'une sonde (début).
test('sondes : altitude, vitesse, période (vis-viva), visibilité de la Terre', () => {
  // Rayon d'une orbite à 100 km d'altitude et vitesse circulaire.
  const r0 = MOON_RADIUS_KM + 100, vc = Math.sqrt(4902.8001 / r0); // orbite circulaire à 100 km (≈ LRO)
  // Points de la trajectoire.
  const pts = [];
  // Pour 40 points (début).
  for (let i = 0; i < 40; i++) {
    // Instant, toutes les 2 minutes, et angle parcouru.
    const t = i * 120000, w = (vc / r0) * (t / 1000);
    // Position sur le cercle.
    pts.push({ t, x: r0 * Math.cos(w), y: r0 * Math.sin(w), z: 0 });
  // Fin de la boucle.
  }
  // État de la sonde entre deux points.
  const st = orbiterStateAt(pts, 20 * 120000 + 3000);
  // Direction de la Terre, dans le repère de la scène.
  const toEarth = eclToScene([1, 0, 0]);
  // Mesures de la sonde.
  const m = orbiterMetrics(st, (v) => v, toEarth);
  // Altitude de 100 km, à 0,5 km près.
  assert.ok(Math.abs(m.altitudeKm - 100) < 0.5, `altitude ${m.altitudeKm}`);
  // Vitesse circulaire, à 0,01 km/s près.
  assert.ok(Math.abs(m.speedKmS - vc) < 0.01);
  // Période de 117,8 minutes, à 1,5 minute près.
  assert.ok(Math.abs(m.periodMin - 117.8) < 1.5, `période ${m.periodMin}`);
  // Derrière la Lune vue de la Terre : masquée.
  // Sonde à l'opposé de la Terre : la Terre n'est pas visible.
  assert.equal(orbiterMetrics({ r: [-r0, 0, 0], v: [0, vc, 0] }, (v) => v, toEarth).earthVisible, false);
  // Sonde du côté de la Terre : visible.
  assert.equal(orbiterMetrics({ r: [r0, 0, 0], v: [0, vc, 0] }, (v) => v, toEarth).earthVisible, true);
  // Avant le premier point : aucun état.
  assert.equal(orbiterStateAt(pts, -1), null);
// Fin du test.
});

// Test, asynchrone : l'étiquette est cachée quand la Lune est entre la caméra et la sonde (début).
test('sondes : étiquette cachée quand la Lune est entre la caméra et la sonde', async () => {
  // moonOrbiters.js importe three : on teste la fonction géométrique seule, recopiée de façon indépendante.
  // Lit le texte du fichier moonOrbiters.jsx.
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../moonOrbiters.jsx', import.meta.url), 'utf8'));
  // En garde la fin, à partir de la fonction segmentHitsSphere.
  const body = src.slice(src.indexOf('export function segmentHitsSphere'));
  // Recrée la fonction à partir de ce texte.
  const segmentHitsSphere = new Function(`${body.replace('export ', '')}; return segmentHitsSphere;`)();
  // Sonde derrière la Lune : le segment touche la sphère.
  assert.equal(segmentHitsSphere([0, 0, 10], [0, 0, -1.1], 1), true);   // sonde derrière la Lune
  // Sonde devant : il ne la touche pas.
  assert.equal(segmentHitsSphere([0, 0, 10], [0, 0, 1.1], 1), false);   // sonde devant
  // Sonde à côté du disque : il ne la touche pas.
  assert.equal(segmentHitsSphere([0, 0, 10], [1.5, 0, -1], 1), false);  // à côté du disque
// Fin du test.
});

// ------------------------------------------------------------ Danuri / ShadowCam : mosaïques polaires
// Importe buildMosaicGrid et polarToLonLat, le maillage d'une mosaïque et la projection polaire inverse, depuis shadowcamMath.
import { buildMosaicGrid, polarToLonLat } from '../shadowcamMath';

// Test : la projection stéréographique polaire et le maillage centré sur le cratère (début).
test('ShadowCam : stéréographique polaire et maillage centré sur le cratère', () => {
  // Projection du pôle Sud, sur une sphère de 1 737 400 m.
  const sp = { pole: 'south', lon0: 0, k0: 1, radius: 1737400 };
  // Distance au pôle d'un point situé à 0,2° du pôle.
  const rho = 2 * 1737400 * Math.tan((0.2 * Math.PI) / 180);
  // Longitude et latitude du point à cette distance, dans la direction 135°.
  const [lon, lat] = polarToLonLat(rho * Math.sin((135 * Math.PI) / 180), rho * Math.cos((135 * Math.PI) / 180), sp);
  // Il est à 135° de longitude et −89,6° de latitude.
  assert.ok(Math.abs(lon - 135) < 1e-9 && Math.abs(lat + 89.6) < 1e-9);
  // Mosaïque de 20 km centrée sur Shackleton (89,6° S, 135° E).
  // Mosaïque de 1 000 × 1 000 pixels de 20 m, centrée sur ce point.
  const meta = { ...sp, width: 1000, height: 1000, resX: 20, resY: 20, originX: rho * Math.sin(2.356194) - 10000, originY: rho * Math.cos(2.356194) + 10000 };
  // Son maillage, en 8 × 8.
  const g = buildMosaicGrid(meta, 8);
  // Longitude et latitude de son centre.
  const [clon, clat] = xyzToLonLat(g.center);
  // Il est à −89,6° et 135°, à la tolérance près.
  assert.ok(Math.abs(clat + 89.6) < 0.01 && Math.abs(clon - 135) < 0.5, `centre ${clon} ${clat}`);
  // Son rayon est la demi-diagonale de 20 km, en rayons lunaires.
  assert.ok(Math.abs(g.radius - (Math.SQRT2 * 10000) / 1737400) < 2e-4);
  // 8 × 8 carrés de 6 indices.
  assert.equal(g.indices.length, 8 * 8 * 6);
  // Les uv du premier sommet sont (0, 1).
  assert.deepEqual([g.uvs[0], g.uvs[1]], [0, 1]); // coin haut-gauche de l'image
  // Le même calcul pour le pôle Nord.
  const np = polarToLonLat(0, -rho, { ...sp, pole: 'north' });
  // Le point est à 89,6° de latitude et 0° de longitude.
  assert.ok(Math.abs(np[1] - 89.6) < 1e-9 && Math.abs(np[0]) < 1e-9);
// Fin du test.
});
