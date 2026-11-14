// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis relief (début de la liste).
import {
  // Les fonctions de décodage des altitudes, de réglage du relief et la classe de la source des tuiles d'altitude.
  groundFloorRadii, MAX_DEPTH_M, metersPerTexel, normalizeRelief, oceanChoice, pointInTile, reliefChoice, ReliefSource, seaFloorMeters, templateFromTileJson, terrariumMeters, terrariumPixel, terrariumRaw, texelAt, tuneRelief,
// Fin de la liste : le module relief.
} from './relief';
// Importe buildTileGrid, le maillage d'une tuile, depuis tileGeometry.
import { buildTileGrid } from './tileGeometry';

// Test : le décodage d'une altitude au format Terrarium.
test('altitude Terrarium : décodage, mer ramenée à 0, aller-retour', () => {
  // Pixel (128, 0, 0) : 0 m.
  assert.equal(terrariumMeters(128, 0, 0), 0);
  // Pixel (134, 229, 128) : 1765,5 m.
  assert.equal(terrariumMeters(134, 229, 128), 1765.5);
  // Pixel (100, 0, 0), sous le niveau de la mer : 0 m.
  assert.equal(terrariumMeters(100, 0, 0), 0); // fond marin (−7 168 m) : mer plate
  // Quatre altitudes encodées puis décodées : inchangées.
  for (const m of [0, 12.25, 4808, 8848.5]) assert.equal(terrariumMeters(...terrariumPixel(m)), m);
// Fin du test.
});

// Test : la taille au sol d'un pixel d'altitude.
test('taille au sol d’un pixel d’altitude', () => {
  // Rayon de la Terre en mètres.
  const R = 6_371_000;
  // Niveau 12 à l'équateur : 38,17 m, à 5 cm près.
  assert.ok(Math.abs(metersPerTexel(12, 0, R) - 38.17) < 0.05);
  // Niveau 12 à 60° de latitude : 19,09 m.
  assert.ok(Math.abs(metersPerTexel(12, 60, R) - 19.09) < 0.05);
  // À 89,9° de latitude : toujours positive.
  assert.ok(metersPerTexel(12, 89.9, R) > 0); // jamais nul près des pôles
  // Niveau 12 à l'équateur, tuiles de 512 pixels : 19,09 m.
  assert.ok(Math.abs(metersPerTexel(12, 0, R, 512) - 19.09) < 0.05); // tuile de 512 px : deux fois plus fine
// Fin du test.
});

// Test : la mise en forme du réglage de relief d'un astre.
test('réglage d’un astre : complété, borné, ou absent', () => {
  // Réglage Terrarium minimal, pour un rayon de 6371 km.
  const earth = normalizeRelief({ kind: 'terrarium', template: 'https://h/{z}/{x}/{y}.png' }, 6371);
  // Il est complété : source, rayon en mètres, niveaux 5 à 12, 16 segments, exagération 1, ombrage 0,8.
  assert.deepEqual(earth, { kind: 'terrarium', sources: [{ template: 'https://h/{z}/{x}/{y}.png' }], radiusM: 6_371_000, minZoom: 5, maxZoom: 12, segments: 16, exaggeration: 1, shade: 0.8 });
  // Réglage avec trois sources, dont une vide.
  const two = normalizeRelief({ kind: 'terrarium', sources: [{ tilejson: 'https://a/t.json' }, { template: 'https://b/{z}/{x}/{y}.png' }, {}] }, 6371);
  // Deux sources sont gardées.
  assert.equal(two.sources.length, 2);
  // Niveau maximal de 20 : ramené à 15.
  assert.equal(normalizeRelief({ kind: 'terrarium', template: 'x', maxZoom: 20, exaggeration: 50 }, 6371).maxZoom, 15);
  // Exagération de 50 : ramenée à 10.
  assert.equal(normalizeRelief({ kind: 'terrarium', template: 'x', exaggeration: 50 }, 6371).exaggeration, 10);
  // Réglage par l'image : force 0,5 par défaut.
  assert.deepEqual(normalizeRelief({ kind: 'image' }, 3389), { kind: 'image', strength: 0.5 });
  // Terrarium sans source : null.
  assert.equal(normalizeRelief({ kind: 'terrarium' }, 6371), null);
  // Type inconnu : null.
  assert.equal(normalizeRelief({ kind: 'autre' }, 6371), null);
  // Réglage absent : null.
  assert.equal(normalizeRelief(undefined, 6371), null);
// Fin du test.
});

// Test : le choix de l'utilisateur.
test('choix de l’utilisateur : coupé, exagéré, ou par défaut', () => {
  // Rien de gardé : actif, exagération par défaut.
  assert.deepEqual(reliefChoice(null, 1), { on: true, exaggeration: 1 });
  // « 0 » : coupé.
  assert.deepEqual(reliefChoice('0', 1), { on: false, exaggeration: 0 });
  // « 2.5 » : actif, exagération 2,5.
  assert.deepEqual(reliefChoice('2.5', 1), { on: true, exaggeration: 2.5 });
  // « 99 » : actif, exagération bornée à 10.
  assert.deepEqual(reliefChoice('99', 1), { on: true, exaggeration: 10 });
  // Valeur illisible : actif, exagération par défaut.
  assert.deepEqual(reliefChoice('abc', 1.5), { on: true, exaggeration: 1.5 });
  // Relief en volume de la Terre : coupé tant que rien n'est choisi, allumé dès qu'un choix est gardé.
  // Rien de gardé, relief coupé par défaut : coupé.
  assert.deepEqual(reliefChoice(null, 1, false), { on: false, exaggeration: 0 });
  // Valeur illisible, relief coupé par défaut : coupé.
  assert.deepEqual(reliefChoice('abc', 1, false), { on: false, exaggeration: 0 });
  // « 1 », relief coupé par défaut : actif.
  assert.deepEqual(reliefChoice('1', 1, false), { on: true, exaggeration: 1 });
  // « 0 », relief coupé par défaut : coupé.
  assert.deepEqual(reliefChoice('0', 1, false), { on: false, exaggeration: 0 });
// Fin du test.
});

// Test : la position d'un point dans une tuile et le pixel d'altitude.
test('point dans une tuile et pixel d’altitude correspondant', () => {
  // Limites d'une tuile d'un degré de côté.
  const bounds = { west: 6, east: 7, north: 46, south: 45 };
  // Un point au quart ouest et au quart nord : u 0,25 et v 0,75.
  assert.deepEqual(pointInTile(bounds, 6.25, 45.75), { u: 0.25, v: 0.75 });
  // Un point à l'est de la tuile : null.
  assert.equal(pointInTile(bounds, 7.5, 45.5), null);
  // Un point au nord de la tuile : null.
  assert.equal(pointInTile(bounds, 6.5, 46.5), null);
  // Tuile qui affiche l'image entière : nord en haut de l'image.
  // Image entière : le pixel (64, 64).
  assert.deepEqual(texelAt([0, 0, 1, 1], 0.25, 0.75, 256, 256), { px: 64, py: 64 });
  // Tuile qui n'affiche que le quart sud-est de l'image d'altitude (rect : u0, v0 depuis le bas, largeur, hauteur).
  // Quart sud-est de l'image : le pixel (192, 192).
  assert.deepEqual(texelAt([0.5, 0, 0.5, 0.5], 0.5, 0.5, 256, 256), { px: 192, py: 192 });
  // Coin extrême : le pixel (255, 255), dernier de l'image.
  assert.deepEqual(texelAt([0, 0, 1, 1], 1, 0, 256, 256), { px: 255, py: 255 });
// Fin du test.
});

// Test : le plancher de la caméra.
test('plancher de la caméra au-dessus du relief', () => {
  // 6371 m d'altitude, exagération 1 : 0,001 rayon.
  assert.equal(groundFloorRadii(6371, 1, 6_371_000), 0.001);
  // Exagération 2 : 0,002 rayon.
  assert.equal(groundFloorRadii(6371, 2, 6_371_000), 0.002);
  // Altitude négative : 0.
  assert.equal(groundFloorRadii(-50, 1, 6_371_000), 0);
// Fin du test.
});

// Test : l'allègement du relief sur téléphone.
test('relief allégé sur téléphone, inchangé sur ordinateur', () => {
  // Réglage Terrarium de la Terre.
  const earth = normalizeRelief({ kind: 'terrarium', template: 'https://h/{z}/{x}/{y}.png' }, 6371);
  // Ordinateur : même réglage, avec l'altitude partagée (une tuile d'altitude de 512 px pour quatre tuiles d'image).
  // Sur ordinateur : le même réglage, avec coarse à 1.
  assert.deepEqual(tuneRelief(earth, false), { ...earth, coarse: 1 });
  // Réglage par l'image.
  const img = { kind: 'image', strength: 0.5 };
  // Sur ordinateur : rendu tel quel.
  assert.equal(tuneRelief(img, false), img);
  // Réglage de la Terre sur téléphone.
  const phone = tuneRelief(earth, true);
  // 8 segments, niveaux 6 à 11, coarse à 1.
  assert.deepEqual([phone.segments, phone.minZoom, phone.maxZoom, phone.coarse], [8, 6, 11, 1]);
  // Réglage par l'image sur téléphone : force 0,4.
  assert.equal(tuneRelief({ kind: 'image', strength: 0.5 }, true).strength, 0.4);
  // Réglage absent : null.
  assert.equal(tuneRelief(null, true), null);
// Fin du test.
});

// Test : la lecture d'une fiche TileJSON.
test('fiche TileJSON : adresse https avec {z}, {x}, {y}, sinon rien', () => {
  // Adresse https avec les trois jetons et un niveau maximal : gardés.
  assert.deepEqual(templateFromTileJson({ tiles: ['https://t/{z}/{x}/{y}.webp'], maxzoom: 17 }), { template: 'https://t/{z}/{x}/{y}.webp', maxZoom: 17 });
  // Sans niveau maximal : null à sa place.
  assert.deepEqual(templateFromTileJson({ tiles: ['https://t/{z}/{x}/{y}.webp'] }), { template: 'https://t/{z}/{x}/{y}.webp', maxZoom: null });
  // Adresse en http : null.
  assert.equal(templateFromTileJson({ tiles: ['http://t/{z}/{x}/{y}.webp'] }), null);
  // Adresse sans jetons : null.
  assert.equal(templateFromTileJson({ tiles: ['https://t/tuiles.webp'] }), null);
  // Fiche vide : null.
  assert.equal(templateFromTileJson({}), null);
  // Fiche absente : null.
  assert.equal(templateFromTileJson(null), null);
// Fin du test.
});

/** Source simulée : `json(url)` et `image(url)` renvoient une valeur ou lèvent. */
// makeRelief : source d'altitude simulée ; par défaut la fiche échoue et l'image réussit (début).
function makeRelief(sources, { json = () => { throw new Error('pas de fiche'); }, image = (url) => ({ url }) } = {}) {
  // Adresses demandées.
  const asked = [];
  // Source créée avec de faux accès (début).
  const source = new ReliefSource({ sources, minZoom: 5, maxZoom: 12 }, {
    // fetchJson : note l'adresse et renvoie la fiche simulée.
    fetchJson: async (url) => { asked.push(url); return json(url); },
    // loadImage : note l'adresse et renvoie l'image simulée.
    loadImage: async (url) => { asked.push(url); return image(url); },
  // Fin des faux accès.
  });
  // Renvoie la source et les adresses demandées.
  return { source, asked };
// Fin de makeRelief.
}

// Test, asynchrone : l'adresse lue dans la fiche.
test('tuiles d’altitude : adresse lue dans la fiche, un seul téléchargement par adresse', async () => {
  // Source avec une fiche TileJSON puis une adresse de secours,
  const { source, asked } = makeRelief([{ tilejson: 'https://m/tilejson.json' }, { template: 'https://aws/{z}/{x}/{y}.png' }],
    // la fiche donnant un modèle d'adresse et un niveau maximal de 17.
    { json: () => ({ tiles: ['https://m/{z}/{x}/{y}.webp'], maxzoom: 17 }) });
  // Deux chargements simultanés de la même tuile.
  const [a, b] = await Promise.all([source.loadImage({ z: 12, x: 5, y: 7 }), source.loadImage({ z: 12, x: 5, y: 7 })]);
  // Ils rendent la même image.
  assert.equal(a, b);
  // Deux adresses demandées : la fiche, puis la tuile une seule fois.
  assert.deepEqual(asked, ['https://m/tilejson.json', 'https://m/12/5/7.webp']);
  // Le niveau maximal reste 12.
  assert.equal(source.maxZoom, 12); // jamais plus fin que le niveau demandé
  // La source n'est pas abandonnée.
  assert.equal(source.broken, false);
// Fin du test.
});

// Test, asynchrone : le niveau de la tuile d'altitude selon l'appareil.
test('téléphone, tuiles de 512 px : tuile d’altitude du niveau au-dessus ; 256 px ou ordinateur : même niveau', async () => {
  // Faux accès qui réussissent toujours.
  const io = { fetchJson: async () => ({}), loadImage: async (url) => ({ url }) };
  // Source de téléphone : tuiles de 512 pixels d'abord, niveaux 6 à 11, coarse à 1.
  const phone = new ReliefSource({ sources: [{ template: 'https://m/{z}/{x}/{y}.webp', tileSize: 512 }, { template: 'https://aws/{z}/{x}/{y}.png' }], minZoom: 6, maxZoom: 11, coarse: 1 }, io);
  // Attend qu'elle soit prête.
  await phone.ready();
  // Niveaux d'altitude pour les niveaux 8, 11, 15 et 0 : 7, 10, 11 et 0.
  assert.deepEqual([phone.levelFor(8), phone.levelFor(11), phone.levelFor(15), phone.levelFor(0)], [7, 10, 11, 0]);
  // Passe à la source suivante, en 256 pixels.
  phone.next();
  // Attend qu'elle soit prête.
  await phone.ready();
  // Niveaux d'altitude pour 8 et 15 : 8 et 11.
  assert.deepEqual([phone.levelFor(8), phone.levelFor(15)], [8, 11]);
  // Source d'ordinateur, en 512 pixels, niveaux 5 à 12.
  const desk = new ReliefSource({ sources: [{ template: 'https://m/{z}/{x}/{y}.webp', tileSize: 512 }], minZoom: 5, maxZoom: 12 }, io);
  // Attend qu'elle soit prête.
  await desk.ready();
  // Niveaux d'altitude pour 8 et 14 : 8 et 12.
  assert.deepEqual([desk.levelFor(8), desk.levelFor(14)], [8, 12]);
// Fin du test.
});

// Test, asynchrone : la fiche introuvable.
test('fiche introuvable : source suivante, sans attendre', async () => {
  // Source dont la fiche échoue, avec une adresse de secours.
  const { source, asked } = makeRelief([{ tilejson: 'https://m/tilejson.json' }, { template: 'https://aws/{z}/{x}/{y}.png' }]);
  // Charge une tuile.
  const img = await source.loadImage({ z: 12, x: 5, y: 7 });
  // Elle vient de l'adresse de secours.
  assert.equal(img.url, 'https://aws/12/5/7.png');
  // Deux adresses demandées : la fiche, puis la tuile de secours.
  assert.deepEqual(asked, ['https://m/tilejson.json', 'https://aws/12/5/7.png']);
// Fin du test.
});

// Test, asynchrone : le remplacement d'une source qui ne répond pas.
test('première source qui n’a jamais répondu : remplacée après 4 échecs ; une source qui a déjà répondu est gardée', async () => {
  // Deux sources,
  const dead = makeRelief([{ template: 'https://m/{z}/{x}/{y}.webp' }, { template: 'https://aws/{z}/{x}/{y}.png' }],
    // dont la première échoue toujours.
    { image: (url) => { if (url.startsWith('https://m/')) throw new Error('réseau'); return { url }; } });
  // Quatre chargements échouent.
  for (let i = 0; i < 4; i++) await assert.rejects(dead.source.loadImage({ z: 12, x: i, y: 7 }));
  // Le cinquième vient de la seconde source.
  assert.equal((await dead.source.loadImage({ z: 12, x: 9, y: 7 })).url, 'https://aws/12/9/7.png');
  // La source n'est pas abandonnée.
  assert.equal(dead.source.broken, false);

  // Interrupteur de panne.
  let fail = false;
  // Deux sources,
  const live = makeRelief([{ template: 'https://m/{z}/{x}/{y}.webp' }, { template: 'https://aws/{z}/{x}/{y}.png' }],
    // qui échouent quand l'interrupteur est levé.
    { image: (url) => { if (fail) throw new Error('réseau'); return { url }; } });
  // Un premier chargement réussit.
  await live.source.loadImage({ z: 12, x: 0, y: 0 });
  // Lève l'interrupteur.
  fail = true;
  // Six chargements échouent.
  for (let i = 1; i <= 6; i++) await assert.rejects(live.source.loadImage({ z: 12, x: i, y: 0 }));
  // Baisse l'interrupteur.
  fail = false;
  // Le chargement suivant vient toujours de la première source.
  assert.equal((await live.source.loadImage({ z: 12, x: 20, y: 0 })).url, 'https://m/12/20/0.webp');
// Fin du test.
});

// Test, asynchrone : l'abandon du relief et l'annulation.
test('plus aucune source : relief abandonné ; annulation sans effet sur le téléchargement partagé', async () => {
  // Une seule source, qui échoue toujours.
  const none = makeRelief([{ template: 'https://aws/{z}/{x}/{y}.png' }], { image: () => { throw new Error('réseau'); } });
  // Huit chargements échouent.
  for (let i = 0; i < 8; i++) await assert.rejects(none.source.loadImage({ z: 12, x: i, y: 7 }));
  // La source est abandonnée.
  assert.equal(none.source.broken, true);
  // Une seule source, dont la fiche échoue.
  const noSource = makeRelief([{ tilejson: 'https://m/tilejson.json' }]);
  // Le chargement échoue.
  await assert.rejects(noSource.source.loadImage({ z: 12, x: 1, y: 1 }));
  // La source est abandonnée.
  assert.equal(noSource.source.broken, true);

  // Une source qui fonctionne.
  const ok = makeRelief([{ template: 'https://aws/{z}/{x}/{y}.png' }]);
  // Contrôleur d'annulation.
  const ctrl = new AbortController();
  // Annulation déclenchée.
  ctrl.abort();
  // Un chargement avec ce signal est rejeté avec une erreur AbortError.
  await assert.rejects(ok.source.loadImage({ z: 12, x: 5, y: 7 }, ctrl.signal), { name: 'AbortError' });
  // Le même chargement sans signal réussit.
  assert.equal((await ok.source.loadImage({ z: 12, x: 5, y: 7 })).url, 'https://aws/12/5/7.png');
// Fin du test.
});

// Test : le maillage d'une tuile soulevée par le relief.
test('maillage d’une tuile soulevée : au moins 16 segments par côté, jupes comprises', () => {
  // Maillage ordinaire d'une tuile de niveau 14.
  const flat = buildTileGrid(14, 8500, 5700);
  // Un seul segment par côté.
  assert.deepEqual([flat.nu, flat.nv], [1, 1]);
  // Maillage avec une jupe et 16 segments au minimum.
  const grid = buildTileGrid(14, 8500, 5700, undefined, { skirt: 1e-5, minSegments: 16 });
  // Seize segments par côté.
  assert.deepEqual([grid.nu, grid.nv], [16, 16]);
  // Nombre de sommets : 17 × 17, plus 64 pour la jupe.
  assert.equal(grid.positions.length / 3, 17 * 17 + 64);
  // Nombre d'indices : 16 × 16 cases, plus 64 arêtes de jupe, à six chacune.
  assert.equal(grid.indices.length, 16 * 16 * 6 + 64 * 6);
  // Une grande tuile garde sa propre finesse quand elle dépasse le minimum.
  // Une tuile de niveau 2 a au moins 16 segments.
  assert.ok(buildTileGrid(2, 1, 1, undefined, { minSegments: 16 }).nu >= 16);
// Fin du test.
});

// ---------------------------------------------------------------- fond des océans

// Test : le décodage brut, profondeurs comprises.
test('terrariumRaw garde les profondeurs et met à 0 un pixel sans donnée', () => {
  // 1200 m encodés puis décodés : 1200.
  assert.equal(terrariumRaw(...terrariumPixel(1200)), 1200);
  // −4000 m encodés puis décodés : −4000.
  assert.equal(terrariumRaw(...terrariumPixel(-4000)), -4000);
  // Pixel noir : 0.
  assert.equal(terrariumRaw(0, 0, 0), 0); // pixel noir : −32768 m, hors de toute fosse
  // Le décodage ordinaire rend 0 pour −4000 m.
  assert.equal(terrariumMeters(...terrariumPixel(-4000)), 0); // sans le fond des océans, la mer reste plate
// Fin du test.
});

// Test : l'altitude avec le fond des océans.
test('seaFloorMeters : la terre garde son altitude, la mer prend la profondeur de la seconde source', () => {
  // Terre à 350 m, fond à −2000 m : 350.
  assert.equal(seaFloorMeters(350, -2000), 350);   // terre : la source des fonds est ignorée
  // Mer à 0, fond à −3800 m : −3800.
  assert.equal(seaFloorMeters(0, -3800), -3800);   // mer : profondeur du fond
  // Mer à 0, seconde source à 12 m : 0.
  assert.equal(seaFloorMeters(0, 12), 0);          // côte mal alignée : jamais d'île créée par la source grossière
  // Mer à 0, seconde source absente : 0.
  assert.equal(seaFloorMeters(0, null), 0);        // tuile de profondeurs pas encore arrivée : mer plate
  // Première source à −420 m, seconde absente : −420.
  assert.equal(seaFloorMeters(-420, null), -420);  // première source avec profondeurs (AWS en secours) : gardées
  // Fond à −20 000 m : borné à la profondeur maximale.
  assert.equal(seaFloorMeters(0, -20000), -MAX_DEPTH_M); // valeur aberrante bornée
// Fin du test.
});

// Test : la mise en forme de la source des fonds marins.
test('normalizeRelief lit la source des fonds marins et la borne', () => {
  // Réglage avec une source des fonds, niveau maximal 8.
  const r = normalizeRelief({ kind: 'terrarium', template: 'https://a/{z}/{x}/{y}.png', ocean: { template: 'https://o/{z}/{x}/{y}.png', maxZoom: 8 } }, 6371);
  // Elle est complétée : source, niveaux 0 à 8, tuiles de 256 pixels.
  assert.deepEqual(r.ocean, { sources: [{ template: 'https://o/{z}/{x}/{y}.png' }], minZoom: 0, maxZoom: 8, tileSize: 256 });
  // Sans source des fonds : champ absent.
  assert.equal(normalizeRelief({ kind: 'terrarium', template: 'https://a/{z}/{x}/{y}.png' }, 6371).ocean, undefined);
  // Niveau maximal de 40 : ramené à 12.
  assert.equal(normalizeRelief({ kind: 'terrarium', template: 'https://a/{z}/{x}/{y}.png', ocean: { template: 'https://o/{z}/{x}/{y}.png', maxZoom: 40 } }, 6371).ocean.maxZoom, 12);
// Fin du test.
});

// Test : l'allègement du fond des océans sur téléphone.
test('tuneRelief allège aussi le fond des océans sur téléphone', () => {
  // Réglage avec une source des fonds, niveau maximal 8.
  const r = normalizeRelief({ kind: 'terrarium', template: 'https://a/{z}/{x}/{y}.png', ocean: { template: 'https://o/{z}/{x}/{y}.png', maxZoom: 8 } }, 6371);
  // Sur téléphone : niveau maximal 7.
  assert.equal(tuneRelief(r, true).ocean.maxZoom, 7);
  // Sur ordinateur : niveau maximal 8.
  assert.equal(tuneRelief(r, false).ocean.maxZoom, 8);
// Fin du test.
});

// Test : le choix du fond des océans.
test('oceanChoice : actif par défaut, coupé par « 0 »', () => {
  // Rien de gardé : actif.
  assert.equal(oceanChoice(null), true);
  // « 1 » : actif.
  assert.equal(oceanChoice('1'), true);
  // « 0 » : coupé.
  assert.equal(oceanChoice('0'), false);
// Fin du test.
});

// Test, asynchrone : la source des fonds marins.
test('la source des fonds marins sert une tuile grossière à toutes les tuiles affichées qu’elle couvre', async () => {
  // Réglage avec une source des fonds, niveau maximal 8.
  const r = normalizeRelief({ kind: 'terrarium', template: 'https://a/{z}/{x}/{y}.png', ocean: { template: 'https://o/{z}/{x}/{y}.png', maxZoom: 8 } }, 6371);
  // Adresses demandées.
  const asked = [];
  // Source des fonds, avec de faux accès qui notent les adresses.
  const src = new ReliefSource(r.ocean, { loadImage: async (url) => { asked.push(url); return { url }; }, fetchJson: async () => ({}) });
  // Attend qu'elle soit prête.
  await src.ready();
  // Pour le niveau 12 : le niveau 8.
  assert.equal(src.levelFor(12), 8);
  // Pour le niveau 6 : le niveau 6.
  assert.equal(src.levelFor(6), 6);
  // Charge une tuile de niveau 8.
  await src.loadImage({ z: 8, x: 130, y: 90 });
  // La charge une seconde fois.
  await src.loadImage({ z: 8, x: 130, y: 90 });
  // Une seule adresse a été demandée.
  assert.deepEqual(asked, ['https://o/8/130/90.png']);
// Fin du test.
});

// Test, asynchrone : le préchargement du relief vers le disque.
test('préchargement du relief vers le disque : une requête par tuile, rien sans adresse ni sans disque', async () => {
  // Adresses préchargées.
  const warmed = [];
  // Faux accès, avec un préchargement qui note l'adresse.
  const io = { loadImage: async (url) => ({ url }), fetchJson: async () => ({}), warm: async (url) => { warmed.push(url); return true; } };
  // Source d'altitude avec ces accès.
  const src = new ReliefSource({ sources: [{ template: 'https://m/{z}/{x}/{y}.webp' }], minZoom: 5, maxZoom: 12 }, io);
  // Adresse de la source pas encore connue : rien ne part.
  // Avant qu'elle soit prête : rien ne part.
  assert.equal(src.warm({ z: 8, x: 1, y: 2 }), false);
  // Attend qu'elle soit prête.
  await src.ready();
  // Premier préchargement d'une tuile : lancé.
  assert.equal(src.warm({ z: 8, x: 1, y: 2 }), true);
  // Second préchargement de la même tuile : refusé.
  assert.equal(src.warm({ z: 8, x: 1, y: 2 }), false, 'déjà préchargée pendant la session');
  // Une seule adresse a été préchargée.
  assert.deepEqual(warmed, ['https://m/8/1/2.webp']);
  // Tuile déjà en mémoire (affichée) : pas de préchargement.
  // Charge une autre tuile.
  await src.loadImage({ z: 8, x: 3, y: 3 });
  // Son préchargement est refusé.
  assert.equal(src.warm({ z: 8, x: 3, y: 3 }), false);
  // Un préchargement qui échoue ne casse rien.
  // Source dont le préchargement échoue.
  const failing = new ReliefSource({ sources: [{ template: 'https://m/{z}/{x}/{y}.webp' }], minZoom: 5, maxZoom: 12 }, { ...io, warm: async () => { throw new Error('hors ligne'); } });
  // Attend qu'elle soit prête.
  await failing.ready();
  // Le préchargement est lancé.
  assert.equal(failing.warm({ z: 9, x: 0, y: 0 }), true);
  // Laisse passer un tour de la boucle d'événements.
  await new Promise((r) => setTimeout(r, 0));
  // La source n'est pas abandonnée.
  assert.equal(failing.broken, false);
  // Sans disque (pas de `warm`) : jamais de requête.
  // Source sans fonction de préchargement.
  const plain = new ReliefSource({ sources: [{ template: 'https://m/{z}/{x}/{y}.webp' }], minZoom: 5, maxZoom: 12 }, { loadImage: io.loadImage, fetchJson: io.fetchJson });
  // Attend qu'elle soit prête.
  await plain.ready();
  // Le préchargement est refusé.
  assert.equal(plain.warm({ z: 9, x: 0, y: 0 }), false);
// Fin du test.
});
