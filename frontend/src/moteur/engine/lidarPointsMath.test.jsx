// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe readFileSync, la lecture d'un fichier, depuis le module fs de Node.
import { readFileSync } from 'node:fs';
// Importe gunzipSync, la décompression gzip, depuis le module zlib de Node.
import { gunzipSync } from 'node:zlib';
// Importe la palette, la clé de la racine et les fonctions testées du nuage de points.
import { CLOUD_HEIGHT_M, LIDAR_PALETTE, ROOT_KEY, boxDistance, buildTree, dayTint, decodeNode, groundLevel, levelSpacing, loadProgress, nodeUrl, parentKey, parseNodeKey, selectNodes, showCloud, tileFrame } from './lidarPointsMath';
// Importe le rayon de la Terre en mètres, depuis gps.
import { EARTH_RADIUS_M } from './gps';
// Importe xyzToLonLat, la conversion d'un point en longitude et latitude, depuis tiles/mercator.
import { xyzToLonLat } from './tiles/mercator';

// Dossier de la dalle LiDAR de Paris, dans les données du backend.
const dir = new URL('../../../../backend/data/lidar/paris-0652-6863/', import.meta.url);
// Son manifeste.
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
// L'arbre des nœuds construit à partir du manifeste.
const tree = buildTree(manifest);

/** Encode des points (x, y, z en pas ; classe ; luminosité) au format d'un nœud, pour les tests. */
// encode : écrit des points au format binaire d'un nœud (début).
function encode(points) {
  // Nombre de points et tableau de huit octets par point.
  const n = points.length, raw = new Uint8Array(n * 8);
  // Pour chacun des trois axes (début).
  for (let axis = 0; axis < 3; axis++) {
    // Valeur précédente : 0.
    let prev = 0;
    // Pour chaque point (début).
    points.forEach((p, i) => {
      // Écart avec la valeur précédente.
      const d = p[axis] - prev; prev = p[axis];
      // Écart codé en zigzag sur 16 bits.
      const v = ((d << 1) ^ (d >> 31)) & 0xffff;
      // Son octet de poids faible, dans le premier plan de l'axe.
      raw[axis * 2 * n + i] = v & 255;
      // Son octet de poids fort, dans le second plan de l'axe.
      raw[axis * 2 * n + n + i] = v >> 8;
    // Fin de la boucle des points.
    });
  // Fin de la boucle des axes.
  }
  // La classe et la luminosité de chaque point, dans les deux derniers plans.
  points.forEach((p, i) => { raw[6 * n + i] = p[3]; raw[7 * n + i] = p[4]; });
  // Renvoie le tableau.
  return raw;
// Fin de encode.
}

// Test : les clés de nœud.
test('clés de nœud : lecture, parent, espacement par niveau', () => {
  // « 3-5-2-0 » : niveau 3, x 5, y 2, z 0.
  assert.deepEqual(parseNodeKey('3-5-2-0'), { level: 3, x: 5, y: 2, z: 0 });
  // Clé à trois nombres : null.
  assert.equal(parseNodeKey('3-5-2'), null);
  // Parent de « 3-5-2-1 » : « 2-2-1-0 ».
  assert.equal(parentKey('3-5-2-1'), '2-2-1-0');
  // La racine n'a pas de parent.
  assert.equal(parentKey(ROOT_KEY), null);
  // Espacement au niveau 0 : celui de la racine, 6,8.
  assert.equal(levelSpacing(6.8, 0), 6.8);
  // Au niveau 3 : divisé par huit, 0,85.
  assert.equal(levelSpacing(6.8, 3), 0.85);
// Fin du test.
});

// Test : le décodage d'un nœud.
test('décodage d’un nœud : écarts en zigzag, plans d’octets, classe et luminosité', () => {
  // Coordonnées d'un nœud : 0 à 25 000 pas (1 km en pas de 4 cm), donc des écarts de ±25 000 au plus.
  // Cinq points d'essai, avec de grands écarts.
  const points = [[10, 20000, 5, 1, 170], [9, 20001, 900, 5, 255], [25000, 3, 0, 6, 12], [25000, 3, 0, 4, 99], [0, 25000, 1821, 0, 0]];
  // Encode puis décode ces points.
  const { position, attr } = decodeNode(encode(points), points.length);
  // Les positions décodées sont celles d'origine.
  assert.deepEqual([...position], points.flatMap((p) => p.slice(0, 3)));
  // Les classes et luminosités décodées sont celles d'origine.
  assert.deepEqual([...attr], points.flatMap((p) => p.slice(3)));
  // Un tableau de 15 octets pour 2 points provoque une erreur.
  assert.throws(() => decodeNode(new Uint8Array(15), 2), /15 octets reçus pour 2 points/);
// Fin du test.
});

// Test : le fichier de la racine de la dalle de Paris.
test('fichiers de la dalle de Paris : la racine se décode, ses points sont dans la dalle', () => {
  // Le premier nœud du manifeste.
  const root = manifest.nodes[0];
  // C'est la racine.
  assert.equal(root.k, ROOT_KEY);
  // Son fichier, décompressé.
  const raw = gunzipSync(readFileSync(new URL(`nodes/${root.k}.bin`, dir)));
  // Ses positions et ses attributs décodés.
  const { position, attr } = decodeNode(raw, root.n);
  // Largeur de la dalle en pas.
  const max = Math.round((manifest.bounds.maxX - manifest.bounds.minX) / manifest.step); // 1 km en pas de 4 cm
  // Plus grande hauteur : 0 au départ.
  let top = 0;
  // Pour chaque point (début).
  for (let i = 0; i < root.n; i++) {
    // Ses coordonnées x et y sont dans l'emprise.
    assert.ok(position[i * 3] <= max && position[i * 3 + 1] <= max, 'point dans l’emprise');
    // Garde la plus grande hauteur.
    top = Math.max(top, position[i * 3 + 2]);
    // Sa classe est dans la palette.
    assert.ok(attr[i * 2] < LIDAR_PALETTE.length, 'classe d’affichage connue');
  // Fin de la boucle.
  }
  // Hauteur du nuage en mètres.
  const height = top * manifest.step;
  // Elle dépasse 50 m et ne dépasse pas la hauteur de l'emprise, à 5 cm près.
  assert.ok(height > 50 && height <= manifest.bounds.maxZ - manifest.bounds.minZ + 0.05, `hauteur du nuage ≈ 70 m, reçu ${height}`);
// Fin du test.
});

// Test : l'arbre de la dalle.
test('arbre de la dalle : chaque nœud est rattaché à son parent, cubes emboîtés', () => {
  // Autant de nœuds dans l'arbre que dans le manifeste.
  assert.equal(tree.size, manifest.nodes.length);
  // La racine mesure 1000 m de côté.
  assert.equal(tree.get(ROOT_KEY).size, 1000);
  // Pour chaque nœud (début).
  for (const node of tree.values()) {
    // La racine est passée.
    if (node.key === ROOT_KEY) continue;
    // Son parent.
    const parent = tree.get(parentKey(node.key));
    // Il existe.
    assert.ok(parent, `parent de ${node.key} présent`);
    // Il compte ce nœud parmi ses enfants.
    assert.ok(parent.children.includes(node.key));
    // Le nœud mesure la moitié de son parent.
    assert.equal(node.size, parent.size / 2);
    // Sur les trois axes, son cube est contenu dans celui du parent.
    for (let i = 0; i < 3; i++) assert.ok(node.min[i] >= parent.min[i] && node.min[i] + node.size <= parent.min[i] + parent.size);
  // Fin de la boucle.
  }
  // Niveau le plus profond sous chaque nœud : 5 pour la racine, le sien pour une feuille.
  // Niveau le plus profond sous la racine : 5.
  assert.equal(tree.get(ROOT_KEY).fine, 5);
  // Pour chaque nœud (début).
  for (const node of tree.values()) {
    // Ce niveau n'est jamais inférieur au sien.
    assert.ok(node.fine >= node.level);
    // Pour une feuille : le sien.
    if (!node.children.length) assert.equal(node.fine, node.level);
    // Sinon : le plus grand de ceux de ses enfants.
    else assert.equal(node.fine, Math.max(...node.children.map((c) => tree.get(c).fine)));
  // Fin de la boucle.
  }
  // Adresse de la racine : le modèle rempli avec sa clé et son empreinte.
  assert.equal(nodeUrl({ nodeUrl: '/api/v1/lidar/t/{k}?v={h}' }, tree.get(ROOT_KEY)), `/api/v1/lidar/t/0-0-0-0?v=${manifest.nodes[0].h}`);
// Fin du test.
});

// Test : la distance d'un point à un cube.
test('distance à un cube : nulle dedans, euclidienne dehors', () => {
  // Point dans le cube : 0.
  assert.equal(boxDistance([5, 5, 5], [0, 0, 0], 10), 0);
  // À 3 du cube sur un axe : 3.
  assert.equal(boxDistance([13, 5, 5], [0, 0, 0], 10), 3);
  // À 3 et 4 sur deux axes : 5.
  assert.equal(boxDistance([13, 14, 5], [0, 0, 0], 10), 5);
// Fin du test.
});

// view : vue d'essai, à 3000 m au-dessus du centre par défaut, modifiable.
const view = (over = {}) => ({ eye: [500, 500, 3000], pxPerUnit: 1200, spacing: manifest.spacing, maxSpacingPx: 1.6, budget: 5e6, ...over });

// Test : le choix des nœuds selon la distance.
test('choix des nœuds : de loin la racine suffit, de près les niveaux fins sont demandés autour de la caméra', () => {
  // all : tout est chargé ; none : rien n'est chargé.
  const all = () => true, none = () => false;
  // À 30 km : 6,8 m × 1200 / 30 000 = 0,27 px entre deux points de la racine → rien d'autre.
  // Vue à 30 km, tout chargé.
  const far = selectNodes(tree, view({ eye: [500, 500, 30000] }), all);
  // Seule la racine est dessinée.
  assert.deepEqual(far.show, [ROOT_KEY]);
  // Rien à charger.
  assert.deepEqual(far.load, []);

  // Rien de chargé : tout ce qui est voulu part au chargement, la racine en tête.
  // Vue à 900 m, rien de chargé.
  const cold = selectNodes(tree, view({ eye: [500, 500, 900] }), none);
  // Rien n'est dessiné.
  assert.deepEqual(cold.show, []);
  // La racine est demandée en premier.
  assert.equal(cold.load[0], ROOT_KEY);
  // Plus de cinq nœuds sont demandés.
  assert.ok(cold.load.length > 5);
  // Les parents passent avant leurs enfants.
  // Pour chaque nœud demandé (début).
  for (const [i, key] of cold.load.entries()) {
    // Son parent.
    const parent = parentKey(key);
    // S'il en a un : il est demandé avant lui.
    if (parent) assert.ok(cold.load.indexOf(parent) < i, `${parent} avant ${key}`);
  // Fin de la boucle.
  }

  // Caméra à 120 m au-dessus d'un coin : les niveaux 4 sont demandés près d'elle, pas à l'autre bout de la dalle.
  // Vue à 150 m au-dessus d'un coin, tout chargé.
  const near = selectNodes(tree, view({ eye: [100, 100, 150] }), all);
  // Clés des nœuds dessinés, décomposées.
  const levels = near.show.map((k) => parseNodeKey(k));
  // Un nœud de niveau 4 est dessiné près de la caméra.
  assert.ok(levels.some((k) => k.level === 4 && k.x < 4 && k.y < 4), 'détail fin près de la caméra');
  // Aucun nœud de niveau 4 n'est dessiné à l'autre bout.
  assert.ok(!levels.some((k) => k.level === 4 && k.x > 12 && k.y > 12), 'pas de détail fin au loin');
// Fin du test.
});

// Test : le budget, le champ de vision et le chargement en attente.
test('choix des nœuds : budget respecté, cubes hors champ écartés, détail en attente demandé', () => {
  // all : tout est chargé.
  const all = () => true;
  // Vue à 200 m avec un budget de 1,2 million de points.
  const tight = selectNodes(tree, view({ eye: [500, 500, 200], budget: 1.2e6 }), all);
  // Nombre total de points dessinés.
  const total = tight.show.reduce((sum, k) => sum + tree.get(k).n, 0);
  // Il ne dépasse pas le budget.
  assert.ok(total <= 1.2e6, `budget dépassé : ${total}`);
  // La racine est dessinée.
  assert.ok(tight.show.includes(ROOT_KEY));
  // Aucun nœud sans son parent.
  // Tout nœud dessiné l'est avec son parent.
  for (const key of tight.show) if (key !== ROOT_KEY) assert.ok(tight.show.includes(parentKey(key)), `${key} sans parent`);

  // Seule la moitié ouest est dans le champ : aucun nœud de l'est n'est demandé (hors racine).
  // Vue où seule la moitié ouest est visible.
  const west = selectNodes(tree, view({ eye: [250, 500, 400], visible: (n) => n.min[0] < 500 }), all);
  // Hors la racine, tous les nœuds dessinés sont dans la moitié ouest.
  assert.ok(west.show.every((k) => k === ROOT_KEY || tree.get(k).min[0] < 500));
  // Plus d'un nœud est dessiné.
  assert.ok(west.show.length > 1);

  // Seule la racine est chargée : elle est dessinée, ses descendants partent au chargement.
  // Vue où seule la racine est chargée.
  const loading = selectNodes(tree, view({ eye: [500, 500, 400] }), (k) => k === ROOT_KEY);
  // Seule la racine est dessinée.
  assert.deepEqual(loading.show, [ROOT_KEY]);
  // D'autres nœuds sont demandés, sans la racine.
  assert.ok(loading.load.length > 0 && !loading.load.includes(ROOT_KEY));
// Fin du test.
});

// Test : le repère de la dalle.
test('repère de la dalle : origine au centre (Beaubourg), axes en mètres, Y vers le nord, Z vers le haut', () => {
  // Le repère : origine et trois axes.
  const f = tileFrame(manifest);
  // Longitude et latitude de l'origine.
  const [lon, lat] = xyzToLonLat(f.origin);
  // Ce sont celles du point d'ancrage, à 1e-6 degré près.
  assert.ok(Math.abs(lat - manifest.anchor.lat) < 1e-6 && Math.abs(lon - manifest.anchor.lon) < 1e-6);
  // len : longueur d'un vecteur ; dot : produit scalaire.
  const len = (v) => Math.hypot(...v), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // 1 m de dalle = 1 m sur la sphère du moteur, à 0,5 % près (la sphère n'est pas l'ellipsoïde).
  // Chaque axe mesure un mètre sur la sphère, à 0,5 % près.
  for (const v of [f.ex, f.ey, f.ez]) assert.ok(Math.abs(len(v) * EARTH_RADIUS_M - 1) < 5e-3, `${len(v) * EARTH_RADIUS_M}`);
  // Les axes X et Y sont perpendiculaires, à 1e-3 près.
  assert.ok(Math.abs(dot(f.ex, f.ey)) / (len(f.ex) * len(f.ey)) < 1e-3, 'X et Y perpendiculaires');
  // Z suit la verticale du lieu.
  // Verticale du lieu : la direction de l'origine.
  const up = f.origin.map((v) => v / len(f.origin));
  // L'axe Z est aligné avec elle.
  assert.ok(dot(f.ez, up) / len(f.ez) > 0.999999);
  // 400 m vers +Y : la latitude augmente d'environ 400 / 111 200 degrés, la longitude à peine (cap de −0,47°).
  // Point à 400 m le long de l'axe Y.
  const north = f.origin.map((v, i) => v + f.ey[i] * 400);
  // Sa longitude et sa latitude.
  const [lon2, lat2] = xyzToLonLat(north);
  // La latitude a augmenté de 400 / 111 200 degrés, à 2e-5 près.
  assert.ok(Math.abs((lat2 - lat) - 400 / 111_200) < 2e-5, `${lat2 - lat}`);
  // La longitude a très légèrement diminué.
  assert.ok(lon2 < lon && lon - lon2 < 1e-4);
// Fin du test.
});

// Test : la teinte selon l'heure.
test('teinte jour / nuit : plein jour clair, nuit sombre et bleutée, sans ombrage rien ne change', () => {
  // Teinte en plein jour et teinte de nuit.
  const noon = dayTint(1), night = dayTint(-0.5);
  // En plein jour : 1,1 sur les trois composantes.
  assert.ok(noon.every((v) => Math.abs(v - 1.1) < 1e-9));
  // De nuit : rouge sous 0,03 et bleu plus fort que le rouge.
  assert.ok(night[0] < 0.03 && night[2] > night[0]);
  // Sans ombrage : 1 sur les trois composantes.
  assert.deepEqual(dayTint(-0.5, 0), [1, 1, 1]);
  // Teinte au crépuscule.
  const dusk = dayTint(0.05);
  // Son rouge est entre celui de la nuit et celui du jour.
  assert.ok(dusk[0] > night[0] && dusk[0] < noon[0]);
// Fin du test.
});

// Test : l'avancement du chargement.
test('avancement du chargement : points dessinés sur points voulus pour la vue', () => {
  // La racine et ses enfants.
  const root = tree.get(ROOT_KEY), kids = root.children.map((k) => tree.get(k));
  // Rien de chargé : 0 %.
  // Rien de dessiné ; la racine et ses enfants demandés.
  const cold = loadProgress(tree, [], [ROOT_KEY, ...root.children]);
  // Points dessinés : 0.
  assert.equal(cold.shown, 0);
  // Points voulus : ceux de la racine et de ses enfants.
  assert.equal(cold.wanted, root.n + kids.reduce((s, n) => s + n.n, 0));
  // Avancement : 0.
  assert.equal(cold.ratio, 0);
  // Racine dessinée, niveau 1 en route.
  // Racine dessinée, enfants demandés.
  const mid = loadProgress(tree, [ROOT_KEY], root.children);
  // Points dessinés : ceux de la racine.
  assert.equal(mid.shown, root.n);
  // Avancement entre 0 et 1.
  assert.ok(mid.ratio > 0 && mid.ratio < 1);
  // Tout est là : 100 %, même s'il n'y a rien à vouloir.
  // Tout dessiné, rien demandé : avancement de 1.
  assert.equal(loadProgress(tree, [ROOT_KEY, ...root.children], []).ratio, 1);
  // Rien dessiné et rien demandé : avancement de 1.
  assert.equal(loadProgress(tree, [], []).ratio, 1);
// Fin du test.
});

// Test : la hauteur du sol et la dalle posée à plat.
test('carte à plat : hauteur du sol du nuage, et dalle posée le sol sur la carte', () => {
  // 120 points : 100 au sol (classe 1) entre 8 et 12 m, 20 toits (classe 5) à 30 m. Pas de 0,04 m.
  // 120 points : leurs positions et leurs attributs.
  const n = 120, position = new Uint16Array(n * 3), attr = new Uint8Array(n * 2);
  // Pour chaque point (début).
  for (let i = 0; i < n; i++) {
    // Les cent premiers sont au sol.
    const ground = i < 100;
    // Hauteur : de 8 à 12 m au sol, 30 m pour les autres, en pas de 4 cm.
    position[i * 3 + 2] = ground ? Math.round((8 + (i % 5)) / 0.04) : Math.round(30 / 0.04);
    // Classe 1 au sol, 5 pour les autres.
    attr[i * 2] = ground ? 1 : 5;
  // Fin de la boucle.
  }
  // La hauteur du sol trouvée vaut 10 m, à 5 cm près.
  assert.ok(Math.abs(groundLevel(position, attr, 0.04) - 10) < 0.05); // médiane du sol, les toits ne comptent pas
  // Avec 30 points seulement : null.
  assert.equal(groundLevel(position.subarray(0, 30 * 3), attr.subarray(0, 30 * 2), 0.04), null); // trop peu de points
  // Dalle posée à sa vraie altitude (25,52 m), puis sol posé sur la carte (bas du nuage à −10 m) : 35,52 m plus bas.
  // Repère à l'altitude réelle, et repère avec le bas du nuage à −10 m.
  const real = tileFrame(manifest), flat = tileFrame(manifest, -10);
  // radius : distance d'une origine au centre de la Terre, en mètres.
  const radius = (o) => Math.hypot(...o) * 6371008.8;
  // Les deux origines sont séparées de 35,52 m en hauteur, à 5 cm près.
  assert.ok(Math.abs((radius(real.origin) - radius(flat.origin)) - 35.52) < 0.05);
  // Même endroit et mêmes axes : seule la hauteur change.
  // Verticale du lieu.
  const up = real.origin.map((v) => v / Math.hypot(...real.origin));
  // Vecteur entre les deux origines.
  const side = flat.origin.map((v, i) => v - real.origin[i]);
  // Sa composante verticale.
  const along = side[0] * up[0] + side[1] * up[1] + side[2] * up[2];
  // Sa composante horizontale est inférieure à 1 cm.
  assert.ok(Math.hypot(...side.map((v, i) => v - along * up[i])) * 6371008.8 < 0.01);
// Fin du test.
});

// Test : la hauteur d'affichage du nuage de points.
test('nuage LiDAR : dessiné seulement sous 0,15 km de hauteur', () => {
  // La hauteur limite vaut 150 m, soit les 0,15 km affichés par le HUD.
  assert.equal(CLOUD_HEIGHT_M, 150);
  // Juste en dessous de la limite, dans le champ : dessiné.
  assert.equal(showCloud(149, true), true);
  // Tout près du sol : dessiné.
  assert.equal(showCloud(5, true), true);
  // À la limite exacte : pas encore dessiné.
  assert.equal(showCloud(150, true), false);
  // Au-dessus de la limite : masqué.
  assert.equal(showCloud(151, true), false);
  // Bien au-dessus, à 1 km : masqué.
  assert.equal(showCloud(1000, true), false);
  // Sous la limite mais hors du champ de la caméra : masqué.
  assert.equal(showCloud(100, false), false);
  // Caméra sous le plan de la dalle : masqué, elle est de l'autre côté.
  assert.equal(showCloud(-10, true), false);
  // À hauteur nulle : masqué, la caméra est dans le plan de la dalle.
  assert.equal(showCloud(0, true), false);
  // Une autre limite peut être donnée.
  assert.equal(showCloud(200, true, 300), true);
// Fin du test.
});
