// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le décodage des lignes d'une tuile vectorielle et la détection du gzip, depuis vectorTile.
import { decodeLines, isGzip } from './vectorTile';
// Importe depuis roadStyle (début de la liste).
import {
  // La table des types de voie, les niveaux affichés et les fonctions de découpe et de pose des noms.
  BRIDGE_CASING, ROAD_CLASSES, ROAD_MAX_ZOOM, ROAD_MIN_ZOOM, TUNNEL_ALPHA, boxVisible, roadPaint, circlesCollide, clipLine, labelCircles, lineLength, placeLabel, planLabels,
  // Le type de voie, le nom d'une voie, le passage aux pixels et la largeur d'un tracé.
  roadClass, roadLabel, roadTileTransform, roadWidth,
// Fin de la liste : le module roadStyle.
} from './roadStyle';
// Importe l'identifiant du calque des rues et la classe de la source, depuis roadSource.
import { ROADS_LAYER_ID, RoadSource } from './roadSource';

// ---- Petit encodeur de tuile vectorielle (protobuf), pour fabriquer des tuiles d'essai.
// varint : écrit un entier en octets à longueur variable.
const varint = (n) => { const out = []; let v = n; while (v > 127) { out.push((v % 128) | 128); v = Math.floor(v / 128); } out.push(v); return out; };
// zz : code un entier signé en zigzag.
const zz = (n) => (n << 1) ^ (n >> 31);
// field : écrit un champ protobuf, avec sa longueur pour le type 2.
const field = (id, wire, bytes) => [...varint(id * 8 + wire), ...(wire === 2 ? varint(bytes.length) : []), ...bytes];
// str : les octets UTF-8 d'un texte.
const str = (s) => [...new TextEncoder().encode(s)];
// geometry : écrit la géométrie d'une liste de lignes, fermées pour un polygone (début).
function geometry(lines, closed = false) {
  // Octets de la géométrie et position courante.
  const g = []; let x = 0, y = 0;
  // Pour chaque ligne (début).
  for (const pts of lines) {
    // Commande « aller à » vers son premier point, en écart depuis la position courante.
    g.push(...varint((1 << 3) | 1), ...varint(zz(pts[0] - x)), ...varint(zz(pts[1] - y))); x = pts[0]; y = pts[1];
    // Commande « tracer jusqu'à », répétée pour les points restants.
    g.push(...varint((((pts.length / 2) - 1) << 3) | 2));
    // Chaque point suivant, en écart depuis le précédent.
    for (let i = 2; i < pts.length; i += 2) { g.push(...varint(zz(pts[i] - x)), ...varint(zz(pts[i + 1] - y))); x = pts[i]; y = pts[i + 1]; }
    // Polygone : commande « fermer », qui ramène le contour à son premier point.
    if (closed) g.push(...varint((1 << 3) | 7));
  // Fin de la boucle.
  }
  // Renvoie les octets.
  return g;
// Fin de geometry.
}
/** layers : [{ name, extent?, features: [{ type?, props, lines }] }] → octets de la tuile. */
// Déclare et exporte encodeTile : la liste des couches à écrire.
export function encodeTile(layers) {
  // Octets de la tuile.
  const tile = [];
  // Pour chaque couche (début).
  for (const layer of layers) {
    // Ses clés, ses valeurs, et son corps qui commence par la version 2 et le nom.
    const keys = [], values = [], body = [...field(15, 0, varint(2)), ...field(1, 2, str(layer.name))];
    // Pour chaque objet (début).
    for (const f of layer.features) {
      // Ses propriétés, en paires d'indices.
      const tags = [];
      // Pour chaque propriété (début).
      for (const [k, v] of Object.entries(f.props)) {
        // Ajoute la clé si elle est nouvelle.
        if (!keys.includes(k)) keys.push(k);
        // Cherche la valeur parmi celles déjà connues.
        let vi = values.findIndex((x) => x === v);
        // L'ajoute si elle est nouvelle.
        if (vi < 0) { values.push(v); vi = values.length - 1; }
        // Écrit l'indice de la clé et celui de la valeur.
        tags.push(...varint(keys.indexOf(k)), ...varint(vi));
      // Fin de la boucle des propriétés.
      }
      // Ajoute l'objet au corps : ses propriétés, son type (ligne par défaut) et sa géométrie.
      body.push(...field(2, 2, [...field(2, 2, tags), ...field(3, 0, varint(f.type ?? 2)), ...field(4, 2, geometry(f.lines, f.type === 3))]));
    // Fin de la boucle des objets.
    }
    // Ajoute chaque clé au corps.
    for (const k of keys) body.push(...field(3, 2, str(k)));
    // Ajoute chaque valeur au corps : chaîne, booléen ou entier.
    for (const v of values) body.push(...field(4, 2, typeof v === 'string' ? field(1, 2, str(v)) : typeof v === 'boolean' ? field(7, 0, [v ? 1 : 0]) : field(4, 0, varint(v))));
    // Ajoute l'étendue, 4096 par défaut.
    body.push(...field(5, 0, varint(layer.extent ?? 4096)));
    // Ajoute la couche à la tuile.
    tile.push(...field(3, 2, body));
  // Fin de la boucle des couches.
  }
  // Renvoie les octets de la tuile.
  return Uint8Array.from(tile);
// Fin de encodeTile.
}

// Test : la lecture d'une tuile vectorielle.
test('tuile vectorielle : lignes, propriétés demandées, couches non demandées sautées', () => {
  // Tuile d'essai (début).
  const bytes = encodeTile([
    // Couche « water » : une surface.
    { name: 'water', features: [{ type: 3, props: { class: 'ocean' }, lines: [[0, 0, 4096, 0, 4096, 4096]] }] },
    // Couche « transportation » (début).
    { name: 'transportation', features: [
      // Une autoroute en tunnel, qui dépasse de la tuile des deux côtés.
      { props: { class: 'motorway', brunnel: 'tunnel', oneway: 1 }, lines: [[-64, 100, 2000, 120, 4160, 90]] },
      // Une rue faite de deux lignes.
      { props: { class: 'minor' }, lines: [[10, 10, 20, 30], [500, 500, 600, 650, 700, 640]] },
      // Un point.
      { type: 1, props: { class: 'minor' }, lines: [[5, 5, 6, 6]] }, // point : ignoré
    // Fin de la couche.
    ] },
    // Couche « transportation_name » : une voie nommée.
    { name: 'transportation_name', features: [{ props: { class: 'primary', name: 'Rue de Rivoli', ref: 'D 1' }, lines: [[0, 0, 4096, 4096]] }] },
  // Fin de la tuile d'essai.
  ]);
  // Décode les deux couches de transport, avec les propriétés demandées.
  const out = decodeLines(bytes, { transportation: ['class', 'brunnel'], transportation_name: ['class', 'name', 'ref'] });
  // Seules ces deux couches sont rendues.
  assert.deepEqual(Object.keys(out).sort(), ['transportation', 'transportation_name']);
  // Étendue : 4096.
  assert.equal(out.transportation.extent, 4096);
  // Deux objets dans « transportation ».
  assert.equal(out.transportation.features.length, 2);
  // Propriétés du premier : la classe et le tunnel.
  assert.deepEqual(out.transportation.features[0].props, { class: 'motorway', brunnel: 'tunnel' }); // « oneway » non demandé
  // Ses points sont ceux d'origine.
  assert.deepEqual(Array.from(out.transportation.features[0].lines[0].points), [-64, 100, 2000, 120, 4160, 90]);
  // Sa boîte englobante.
  assert.deepEqual(out.transportation.features[0].lines[0].box, [-64, 90, 4160, 120]);
  // Le second objet a deux lignes.
  assert.equal(out.transportation.features[1].lines.length, 2);
  // Les points de sa seconde ligne sont ceux d'origine.
  assert.deepEqual(Array.from(out.transportation.features[1].lines[1].points), [500, 500, 600, 650, 700, 640]);
  // Propriétés de la voie nommée.
  assert.deepEqual(out.transportation_name.features[0].props, { class: 'primary', name: 'Rue de Rivoli', ref: 'D 1' });
  // Une couche absente de la tuile : résultat vide.
  assert.deepEqual(decodeLines(bytes, { absente: null }), {});
  // Une tuile tronquée de trois octets provoque une erreur.
  assert.throws(() => decodeLines(bytes.subarray(0, bytes.length - 3), { transportation_name: null }));
  // Deux octets de signature gzip : reconnu.
  assert.equal(isGzip(Uint8Array.from([0x1f, 0x8b, 8])), true);
  // La tuile d'essai : pas du gzip.
  assert.equal(isGzip(bytes), false);
// Fin du test.
});

// Test : les types de voie et les largeurs.
test('types de voie : routes et voies ferrées gardées, ferry et chantiers écartés, largeur fine de loin', () => {
  // Une autoroute reste une autoroute.
  assert.equal(roadClass({ class: 'motorway' }), 'motorway');
  // Une voie de bus devient une rue.
  assert.equal(roadClass({ class: 'busway' }), 'minor');
  // Rail, ferry, transport en commun, chantier, jetée et classe absente : null.
  // Voie ferrée gardée ; tram et métro aérien dessinés comme une voie ferrée.
  assert.equal(roadClass({ class: 'rail' }), 'rail');
  assert.equal(roadClass({ class: 'transit' }), 'rail');
  for (const c of ['ferry', 'motorway_construction', 'pier', undefined]) assert.equal(roadClass({ class: c }), null);
  // Propriétés absentes : null.
  assert.equal(roadClass(null), null);
  // Grands axes visibles de loin, rues en zoomant, chemins en dernier.
  // L'autoroute et la voie rapide sont tracées dès le premier niveau du calque.
  assert.ok(ROAD_CLASSES.motorway.minZoom <= ROAD_MIN_ZOOM && ROAD_CLASSES.trunk.minZoom <= ROAD_MIN_ZOOM);
  // La rue à partir du niveau 12 au moins, le sentier à partir du niveau 15 au moins.
  assert.ok(ROAD_CLASSES.minor.minZoom >= 12 && ROAD_CLASSES.path.minZoom >= 15);
  // Le nom d'une rue apparaît plus tard que celui d'une route principale.
  assert.ok(ROAD_CLASSES.minor.nameZoom > ROAD_CLASSES.primary.nameZoom);
  // Largeurs : croissantes avec l'importance et avec le zoom ; au-delà du niveau 14, moins vite que la carte.
  // Au niveau 14 : autoroute plus large que route principale, plus large que rue.
  assert.ok(roadWidth('motorway', 14) > roadWidth('primary', 14) && roadWidth('primary', 14) > roadWidth('minor', 14));
  // L'autoroute s'élargit du niveau 6 au niveau 10, puis au niveau 14.
  assert.ok(roadWidth('motorway', 6) < roadWidth('motorway', 10) && roadWidth('motorway', 10) < roadWidth('motorway', 14));
  // Rapport de largeur d'une rue entre les niveaux 15 et 16.
  const grow = roadWidth('minor', 16) / roadWidth('minor', 15);
  // Il est entre 1 et 2.
  assert.ok(grow > 1 && grow < 2);
  // Type inconnu : largeur 0.
  assert.equal(roadWidth('inconnu', 14), 0);
  // Dernier niveau affiché : 17.
  assert.equal(ROAD_MAX_ZOOM, 17);
// Fin du test.
});

// Test : la tuile de données et le passage aux pixels.
test('tuile de données et passage aux pixels : telle quelle jusqu’au niveau 14, agrandie au-delà', () => {
  // Transformation pour une tuile de niveau 12.
  const same = roadTileTransform({ z: 12, x: 2074, y: 1409 }, 4096, 256);
  // La tuile de données est la tuile elle-même.
  assert.deepEqual(same.data, { z: 12, x: 2074, y: 1409 });
  // Échelle : 256 / 4096.
  assert.equal(same.scale, 256 / 4096);
  // Pas de décalage horizontal.
  assert.equal(same.offsetX, 0);
  // Pas de décalage vertical.
  assert.equal(same.offsetY, 0);
  // Niveau 16 : tuile de niveau 14 agrandie 4 fois ; la tuile affichée en est la case (colonne 3, ligne 1).
  // Transformation pour une tuile de niveau 16, en 512 pixels.
  const t = roadTileTransform({ z: 16, x: 8298 * 4 + 3, y: 5636 * 4 + 1 }, 4096, 512);
  // La tuile de données est son ancêtre de niveau 14.
  assert.deepEqual(t.data, { z: 14, x: 8298, y: 5636 });
  // Échelle : quatre fois 512 / 4096.
  assert.equal(t.scale, (512 * 4) / 4096);
  // Décalage horizontal : trois tuiles vers la gauche.
  assert.equal(t.offsetX, -3 * 512);
  // Décalage vertical : une tuile vers le haut.
  assert.equal(t.offsetY, -512);
  // Le coin haut-gauche de la case (3/4, 1/4 de la tuile de données) tombe en (0, 0).
  // Le point 3072 des données tombe au pixel 0, horizontalement.
  assert.equal(3072 * t.scale + t.offsetX, 0);
  // Le point 1024 des données tombe au pixel 0, verticalement.
  assert.equal(1024 * t.scale + t.offsetY, 0);
  // Une boîte située dans cette case est visible.
  assert.equal(boxVisible([3072, 1024, 3100, 1100], t, 512, 2), true);
  // Une boîte située dans une autre case ne l'est pas.
  assert.equal(boxVisible([0, 0, 3000, 900], t, 512, 2), false);
// Fin du test.
});

// Test : la découpe d'une ligne.
test('découpe d’une ligne au bord de la tuile', () => {
  // Ligne entièrement dans le carré : inchangée.
  assert.deepEqual(clipLine([10, 10, 50, 10, 90, 50], 0, 100), [[10, 10, 50, 10, 90, 50]]);
  // Sort par la droite puis revient : deux portions.
  // Ligne qui sort puis revient : deux portions.
  assert.deepEqual(clipLine([50, 20, 150, 20, 150, 60, 50, 60], 0, 100), [[50, 20, 100, 20], [100, 60, 50, 60]]);
  // Ligne entièrement dehors : aucune portion.
  assert.deepEqual(clipLine([-50, -50, -10, -20], 0, 100), []);
  // Traverse la tuile de part en part.
  // Ligne qui traverse : la portion entre les deux bords.
  assert.deepEqual(clipLine([-100, 50, 200, 50], 0, 100), [[0, 50, 100, 50]]);
  // Longueur d'une ligne de deux segments de 5 et 6 : 11.
  assert.equal(lineLength([0, 0, 3, 4, 3, 10]), 11);
// Fin du test.
});

// Test : la pose d'un nom.
test('pose d’un nom : au milieu de la voie, lisible de gauche à droite, refusé si la voie est trop courte ou trop courbe', () => {
  // Nom de 80 pixels sur une voie droite de 200.
  const p = placeLabel([0, 100, 200, 100], 80, 3);
  // Posé au milieu, angle nul.
  assert.deepEqual(p, { x: 100, y: 100, angle: 0 });
  // Voie parcourue de droite à gauche : le nom reste à l'endroit.
  // Même voie parcourue dans l'autre sens.
  const back = placeLabel([200, 100, 0, 100], 80, 3);
  // Même angle et même milieu.
  assert.ok(Math.abs(back.angle) < 1e-9 && back.x === 100);
  // Voie montante (y diminue vers le haut de l'écran) : angle entre −90° et 90°.
  // Voie qui monte vers la droite.
  const up = placeLabel([0, 200, 100, 0], 60, 3);
  // Angle entre −90° et 0.
  assert.ok(up.angle > -Math.PI / 2 && up.angle < 0);
  // Voie de 50 pixels pour un nom de 80 : null.
  assert.equal(placeLabel([0, 0, 50, 0], 80, 3), null);                    // trop courte
  // Voie en angle droit sous le nom : null.
  assert.equal(placeLabel([0, 0, 100, 0, 100, 100], 120, 3), null);        // coude sous le nom
  // Voie qui s'écarte de 8 pixels de la corde : null.
  assert.equal(placeLabel([0, 0, 60, 8, 120, 0], 100, 3), null);           // trop courbe
  // Voie qui s'écarte de 2 pixels : acceptée.
  assert.notEqual(placeLabel([0, 0, 60, 2, 120, 0], 100, 3), null);        // légère courbe : acceptée
  // Cercles de deux noms proches.
  const a = labelCircles({ x: 100, y: 100, angle: 0 }, 80, 10), b = labelCircles({ x: 110, y: 104, angle: 0.2 }, 60, 10);
  // Ils se chevauchent.
  assert.equal(circlesCollide(a, b), true);
  // Un nom 40 pixels plus bas ne chevauche pas le premier.
  assert.equal(circlesCollide(a, labelCircles({ x: 100, y: 140, angle: 0 }, 80, 10)), false);
// Fin du test.
});

// Test : le choix des noms d'une tuile.
test('choix des noms d’une tuile : grands axes d’abord, sans chevauchement ni répétition, jamais coupés au bord', () => {
  // measure : largeur d'un texte, 6 pixels par caractère.
  const measure = (text) => text.length * 6;
  // Plan des noms pour six candidates (début).
  const plan = planLabels([
    // Une petite rue.
    { label: 'Petite rue', rank: 3, points: [20, 100, 236, 100] },
    // Un boulevard de rang supérieur, 4 pixels plus bas.
    { label: 'Grand boulevard', rank: 6, points: [20, 104, 236, 104] },   // chevauche la petite rue : prioritaire
    // Le même boulevard, 26 pixels plus bas.
    { label: 'Grand boulevard', rank: 6, points: [20, 130, 236, 130] },   // même nom tout près : pas répété
    // Une avenue, plus haut.
    { label: 'Avenue du Nord', rank: 5, points: [20, 30, 236, 30] },
    // Une impasse, presque hors de la tuile.
    { label: 'Impasse', rank: 3, points: [250, 200, 300, 200] },          // presque entièrement hors de la tuile
    // Un nom très long sur une voie de 60 pixels.
    { label: 'Rue très longue au nom interminable', rank: 3, points: [100, 180, 160, 180] }, // voie trop courte
  // Fin des candidates : tuile de 256 pixels, police de 10.
  ], { size: 256, font: 10, measure });
  // Seuls le boulevard et l'avenue sont posés, dans cet ordre.
  assert.deepEqual(plan.map((l) => l.label), ['Grand boulevard', 'Avenue du Nord']);
  // Leur centre est à plus de 40 pixels des bords gauche et droit.
  for (const l of plan) assert.ok(l.x > 40 && l.x < 216);
  // Avec un maximum de 0 : aucun nom.
  assert.equal(planLabels([{ label: 'A', rank: 1, points: [0, 0, 256, 256] }], { size: 256, font: 10, measure, max: 0 }).length, 0);
  // Nom avec des espaces autour : nettoyé.
  assert.equal(roadLabel({ name: ' Rue de la Paix ' }), 'Rue de la Paix');
  // Sans nom : le numéro.
  assert.equal(roadLabel({ ref: 'A 6' }), 'A 6');
  // Nom de 41 caractères : null.
  assert.equal(roadLabel({ name: 'x'.repeat(41) }), null);
  // Sans nom ni numéro : null.
  assert.equal(roadLabel({}), null);
// Fin du test.
});

// ---- Source : faux réseau et faux canevas (le dessin réel est fait par le navigateur).
// fakeCanvas : faux canevas d'une taille donnée (début).
function fakeCanvas(size) {
  // Journal des appels de dessin.
  const calls = [];
  // Faux contexte : un objet qui mesure le texte à 6 pixels par caractère, enveloppé dans un Proxy (début).
  const ctx = new Proxy({ calls, measureText: (t) => ({ width: t.length * 6 }) }, {
    // Lecture : la propriété si elle existe, sinon une fonction qui note l'appel.
    get: (o, k) => (k in o ? o[k] : (...a) => { calls.push([k, ...a]); }),
    // Écriture : la valeur est rangée dans l'objet.
    set: (o, k, v) => { o[k] = v; return true; },
  // Fin du Proxy.
  });
  // Renvoie le canevas, sa taille et son contexte.
  return { width: size, height: size, getContext: () => ctx, ctx };
// Fin de fakeCanvas.
}

// Test, asynchrone : la source des rues.
test('source des rues : adresse lue dans la fiche, tuile de niveau 14 partagée au-delà, tuile vide sans canevas', async () => {
  // Adresses demandées.
  const urls = [];
  // Tuile d'essai (début).
  const tile = encodeTile([
    // Couche « transportation » (début).
    { name: 'transportation', features: [
      // Une route principale à mi-hauteur.
      { props: { class: 'primary' }, lines: [[0, 2048, 4096, 2048]] },
      // Un sentier dans le coin haut gauche.
      { props: { class: 'path' }, lines: [[100, 100, 300, 300]] },
      // Une voie ferrée en diagonale.
      // Une voie ferrée dans le coin bas gauche.
      { props: { class: 'rail' }, lines: [[100, 3500, 900, 3500]] },
    // Fin de la couche.
    ] },
    // Couche « transportation_name » : le nom de la route principale.
    { name: 'transportation_name', features: [{ props: { class: 'primary', name: 'Boulevard Test' }, lines: [[0, 2048, 4096, 2048]] }] },
  // Fin de la tuile d'essai.
  ]);
  // Faux stockage local.
  const store = new Map();
  // Faux accès au réseau et au navigateur (début).
  const io = {
    // fetchJson : la fiche du fournisseur, avec son modèle d'adresse et son niveau maximal.
    fetchJson: async () => ({ tiles: ['https://tiles.exemple/planet/v1/{z}/{x}/{y}.pbf'], maxzoom: 14 }),
    // fetchBytes : note l'adresse ; rien pour le niveau 9, la tuile d'essai sinon.
    fetchBytes: async (url) => { urls.push(url); return url.includes('/9/') ? null : tile; },
    // makeCanvas : le faux canevas.
    makeCanvas: fakeCanvas,
    // storage : lecture et écriture dans le faux stockage.
    storage: () => ({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }),
  // Fin des faux accès.
  };
  // Source créée avec ces accès.
  const source = new RoadSource({ io });
  // Elle n'est pas prête.
  assert.equal(source.ready, false);
  // Attend son démarrage.
  await source.start();
  // Elle est prête.
  assert.equal(source.ready, true);
  // Son calque porte l'identifiant des rues.
  assert.equal(source.layerId, ROADS_LAYER_ID);
  // Le modèle d'adresse a été gardé dans le stockage.
  assert.equal(store.get('gobai:rues-modele'), 'https://tiles.exemple/planet/v1/{z}/{x}/{y}.pbf');
  // Son attribution cite OpenStreetMap.
  assert.match(source.info.attribution.text, /OpenStreetMap/);
  // Le niveau 5 n'est pas couvert.
  assert.equal(source.covers({ z: 5 }), false);
  // Le niveau 6 l'est.
  assert.equal(source.covers({ z: 6 }), true);

  // Niveau 12 : route principale dessinée ; le chemin (niveau 15) et le rail ne le sont pas.
  // Image de la tuile de niveau 12.
  const c12 = await source.loadImage({ z: 12, x: 10, y: 20 });
  // Canevas de 256 pixels.
  assert.equal(c12.width, 256);
  // Une seule adresse demandée, celle de cette tuile.
  assert.deepEqual(urls, ['https://tiles.exemple/planet/v1/12/10/20.pbf']);
  // Deux tracés dessinés.
  assert.equal(c12.ctx.calls.filter((c) => c[0] === 'stroke').length, 2); // liseré + tracé d'un seul groupe
  // Un seul texte écrit : « Boulevard Test ».
  assert.equal(c12.ctx.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]).join(), 'Boulevard Test');

  // Niveaux 15 et 16 : la même tuile de niveau 14, téléchargée une seule fois ; canevas de 512 px.
  // Image d'une tuile de niveau 15.
  const c15 = await source.loadImage({ z: 15, x: 2 * 7 + 1, y: 2 * 9 + 1 });
  // Image d'une tuile de niveau 16, sous la même tuile de niveau 14.
  await source.loadImage({ z: 16, x: 4 * 7 + 1, y: 4 * 9 + 2 });
  // Canevas de 512 pixels.
  assert.equal(c15.width, 512);
  // Une seule adresse de plus : celle de la tuile de niveau 14.
  assert.deepEqual(urls.slice(1), ['https://tiles.exemple/planet/v1/14/7/9.pbf']);
  // Case du niveau 15 où ne passe aucune route (la route principale est à mi-hauteur de la tuile de données, donc au
  // bord des cases ; le chemin est dans la case en haut à gauche) : canevas vide partagé.
  // Image d'une case de niveau 16 sans aucune voie.
  const empty = await source.loadImage({ z: 16, x: 4 * 7 + 3, y: 4 * 9 + 3 });
  // C'est le canevas vide partagé.
  assert.equal(empty, source.emptyCanvas());
  // Il mesure 4 pixels.
  assert.equal(empty.width, 4);

  // Tuile absente chez le fournisseur (océan) : canevas vide, pas d'erreur.
  // Tuile absente au niveau 9 : le canevas vide.
  assert.equal(await source.loadImage({ z: 9, x: 1, y: 1 }), source.emptyCanvas());
  // Annulation.
  // Signal d'annulation déjà déclenché.
  const aborted = new AbortController(); aborted.abort();
  // Le chargement est rejeté avec une erreur AbortError.
  await assert.rejects(source.loadImage({ z: 12, x: 10, y: 20 }, aborted.signal), { name: 'AbortError' });
  // Téléphone : 256 px partout.
  // Sur un appareil tenu en main : 256 pixels au niveau 16.
  assert.equal(new RoadSource({ io, handheld: true }).sizeFor(16), 256);
  // Libère la source.
  source.dispose();
// Fin du test.
});

// Test, asynchrone : la fiche du fournisseur injoignable.
test('source des rues : fiche injoignable → erreur sans adresse gardée, adresse gardée sinon', async () => {
  // Faux accès dont la fiche échoue, sans stockage.
  const io = { fetchJson: async () => { throw new Error('HTTP 503'); }, fetchBytes: async () => null, makeCanvas: fakeCanvas, storage: () => null };
  // Source démarrée avec ces accès.
  const broken = await new RoadSource({ io }).start();
  // Son état est « error ».
  assert.equal(broken.status, 'error');
  // Son message indique que les rues sont indisponibles.
  assert.match(broken.error, /Rues indisponibles/);
  // Source démarrée avec un stockage qui contient déjà un modèle d'adresse.
  const kept = await new RoadSource({ io: { ...io, storage: () => ({ getItem: () => 'https://tiles.exemple/planet/v0/{z}/{x}/{y}.pbf', setItem() {} }) } }).start();
  // Son état est « ready ».
  assert.equal(kept.status, 'ready');
  // Elle utilise le modèle gardé.
  assert.equal(kept.template, 'https://tiles.exemple/planet/v0/{z}/{x}/{y}.pbf');
// Fin du test.
});

// Test, asynchrone : les littoraux tracés dans chaque tuile.
test('source des rues : littoraux de la couche « eau » tracés dans la tuile, sans les bords de la tuile', async () => {
  // Tuile d'essai : la moitié gauche est de la mer (polygone fermé), aucune route.
  const tile = encodeTile([{ name: 'water', features: [{ type: 3, props: {}, lines: [[0, 0, 2048, 0, 2048, 4096, 0, 4096]] }] }]);
  // Faux accès : la fiche du fournisseur, la tuile d'essai, le faux canevas, sans stockage.
  const io = {
    // fetchJson : la fiche, avec son modèle d'adresse.
    fetchJson: async () => ({ tiles: ['https://tiles.exemple/planet/v1/{z}/{x}/{y}.pbf'], maxzoom: 14 }),
    // fetchBytes : toujours la tuile d'essai.
    fetchBytes: async () => tile,
    // makeCanvas : le faux canevas.
    makeCanvas: fakeCanvas,
    // storage : aucun.
    storage: () => null,
  // Fin des faux accès.
  };
  // Source créée et démarrée.
  const source = await new RoadSource({ io }).start();
  // Image d'une tuile de niveau 12.
  const c = await source.loadImage({ z: 12, x: 10, y: 20 });
  // Une vraie tuile (256 px), pas le canevas vide de 4 px : l'eau suffit à dessiner.
  assert.equal(c.width, 256);
  // Un seul trait dessiné : celui des littoraux.
  assert.equal(c.ctx.calls.filter((k) => k[0] === 'stroke').length, 1);
  // Un seul segment : le littoral à x = 2048 ; les trois segments qui longent les bords de la tuile sont écartés.
  assert.equal(c.ctx.calls.filter((k) => k[0] === 'lineTo').length, 1);
  // Teinte des littoraux.
  assert.equal(c.ctx.strokeStyle, '#f2efe6');
// Fin du test.
});

// Test : une seule échelle de couleurs et d'opacités pour les voies et les infrastructures.
test('types de voie : opacité croissante avec l’importance, couleurs opaques, rail en tirets, ponts et tunnels', () => {
  // Types triés par rang.
  const ranked = Object.entries(ROAD_CLASSES).sort((a, b) => a[1].rank - b[1].rank);
  // Pour chaque type : couleur opaque (#rrggbb, la transparence est dans alpha) et opacité entre 0,5 et 1.
  for (const [, c] of ranked) { assert.match(c.color, /^#[0-9a-f]{6}$/); assert.ok(c.alpha >= 0.5 && c.alpha <= 1); }
  // Opacité jamais plus faible pour une voie plus importante.
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i][1].alpha >= ranked[i - 1][1].alpha, ranked[i][0]);
  // Grands axes opaques.
  for (const c of ['primary', 'trunk', 'motorway']) assert.equal(ROAD_CLASSES[c].alpha, 1);
  // Voie ferrée en tirets, à l'échelle du canevas ; route en trait plein.
  assert.deepEqual(roadPaint('rail', {}, 2).dash, [8, 6]);
  assert.deepEqual(roadPaint('primary').dash, []);
  // Tunnel : opacité du type multipliée par celle des tunnels.
  assert.equal(roadPaint('minor', { tunnel: true }).alpha, ROAD_CLASSES.minor.alpha * TUNNEL_ALPHA);
  // Pont : liseré élargi.
  assert.equal(roadPaint('minor', { bridge: true }).casing - roadPaint('minor').casing, BRIDGE_CASING);
// Fin du test.
});
