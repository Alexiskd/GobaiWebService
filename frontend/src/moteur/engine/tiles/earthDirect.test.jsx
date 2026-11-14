// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis earthDirect (début de la liste).
import {
  // Les classes de mesure des couleurs, de coupe-circuit et de mémoire, la taille de la vignette, et les premières fonctions testées.
  ColorStats, DirectBreaker, EmptyMemo, LevelGate, MissingMemo, THUMB, applyGain, blankLike, blankNear, blankRatio, blankZone, candidatesAt, composeOver,
  // Les fonctions de mosaïque, de découpe, de choix des sources et de validation du plan.
  composeZoned, cropRect, farCandidatesAt, fillDirect, isBlankPixels, nextAttempt, tileTouches, validPlan,
// Fin de la liste : le module earthDirect.
} from './earthDirect';

/** Tuile Web Mercator qui contient (lon, lat) au niveau z. */
// tileAt : la tuile qui contient une longitude et une latitude à un niveau (début).
function tileAt(lon, lat, z) {
  // Nombre de tuiles par côté, et latitude en radians.
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  // Renvoie le niveau, la colonne et la ligne, par la formule de Mercator.
  return [z, Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
// Fin de tileAt.
}

// Sources d'essai, par ordre de priorité (début).
const SOURCES = [
  // La Suisse : niveaux 12 à 19, une emprise, une adresse directe.
  { id: 'ch', minZoom: 12, maxZoom: 19, bboxes: [[5.9, 45.8, 10.5, 47.85]], templates: ['https://ch/{z}/{x}/{y}.jpeg'] },
  // La Bavière : niveaux 12 à 19, une emprise, sans adresse directe.
  { id: 'de-by', minZoom: 12, maxZoom: 19, bboxes: [[8.95, 47.25, 13.85, 50.6]] }, // WMS : pas de modèle, relais
  // L'IGN : niveaux 12 à 19, une emprise sur la France, une adresse directe.
  { id: 'ign', minZoom: 12, maxZoom: 19, bboxes: [[-5.5, 41.2, 9.8, 51.2]], templates: ['https://ign/?z={z}&row={y}&col={x}'] },
  // Sentinel-2 : niveaux 0 à 14, sans emprise, deux adresses directes.
  { id: 'sentinel2', minZoom: 0, maxZoom: 14, templates: ['https://eox/a/{z}/{y}/{x}.jpg', 'https://eox/b/{z}/{y}/{x}.jpg'] },
  // GIBS : niveaux 0 à 8, sans emprise, une adresse directe.
  { id: 'gibs', minZoom: 0, maxZoom: 8, templates: ['https://gibs/{z}/{y}/{x}.jpeg'] },
// Fin des sources d'essai.
];
// ids : les identifiants d'une liste de sources.
const ids = (list) => list.map((s) => s.id);

// Test : les emprises et les sources candidates.
test('emprise et sources candidates, dans l’ordre du serveur', () => {
  // Paris est dans l'emprise de la France.
  assert.equal(tileTouches([-5.5, 41.2, 9.8, 51.2], ...tileAt(2.35, 48.85, 12)), true);
  // Berlin n'y est pas.
  assert.equal(tileTouches([-5.5, 41.2, 9.8, 51.2], ...tileAt(13.4, 52.5, 12)), false);
  // À Paris au niveau 17 : l'IGN seul.
  assert.deepEqual(ids(candidatesAt(SOURCES, ...tileAt(2.35, 48.85, 17))), ['ign']);
  // À Paris au niveau 13 : l'IGN puis Sentinel-2.
  assert.deepEqual(ids(candidatesAt(SOURCES, ...tileAt(2.35, 48.85, 13))), ['ign', 'sentinel2']);
  // À Berne au niveau 17 : la Suisse puis l'IGN.
  assert.deepEqual(ids(candidatesAt(SOURCES, ...tileAt(7.45, 46.95, 17))), ['ch', 'ign']);
  // Loin de l'Europe au niveau 5 : Sentinel-2 puis GIBS.
  assert.deepEqual(ids(candidatesAt(SOURCES, ...tileAt(100, 10, 5))), ['sentinel2', 'gibs']);
  // Au Caire au niveau 17 : aucune source.
  assert.deepEqual(candidatesAt(SOURCES, ...tileAt(31.24, 30.04, 17)), []);
// Fin du test.
});

// Test : le remplissage d'un modèle d'adresse.
test('modèle d’adresse rempli, quel que soit l’ordre des marqueurs', () => {
  // Modèle en chemin, avec la ligne avant la colonne.
  assert.equal(fillDirect('https://eox/a/{z}/{y}/{x}.jpg', 3, 1, 2), 'https://eox/a/3/2/1.jpg');
  // Modèle en paramètres.
  assert.equal(fillDirect('https://ign/?z={z}&row={y}&col={x}', 3, 1, 2), 'https://ign/?z=3&row=2&col=1');
// Fin du test.
});

// Test : une tuile de niveau natif.
test('tuile native : chargée en direct chez la source la plus détaillée', () => {
  // Tuile de Paris au niveau 17.
  const [z, x, y] = tileAt(2.35, 48.85, 17);
  // Prochaine tentative.
  const a = nextAttempt(SOURCES, z, x, y);
  // C'est un chargement direct.
  assert.equal(a.kind, 'direct');
  // Chez l'IGN.
  assert.equal(a.source.id, 'ign');
  // De la tuile elle-même, sans découpe.
  assert.deepEqual([a.z, a.x, a.y, a.depth], [z, x, y, 0]);
// Fin du test.
});

// Test : une tuile au-delà du niveau natif.
test('au-delà du niveau natif : ancêtre de niveau 14 à découper', () => {
  // Tuile du Caire au niveau 17.
  const [z, x, y] = tileAt(31.24, 30.04, 17); // Le Caire
  // Prochaine tentative.
  const a = nextAttempt(SOURCES, z, x, y);
  // C'est un chargement direct.
  assert.equal(a.kind, 'direct');
  // Chez Sentinel-2.
  assert.equal(a.source.id, 'sentinel2');
  // De l'ancêtre de niveau 14, trois niveaux plus haut.
  assert.deepEqual([a.z, a.x, a.y, a.depth], [14, x >> 3, y >> 3, 3]);
// Fin du test.
});

// Test : le passage à la source suivante quand une source est vide.
test('source vue vide : on passe à la suivante, puis aux ancêtres', () => {
  // Tuile de Berne au niveau 17.
  const [z, x, y] = tileAt(7.45, 46.95, 17); // Berne : ch puis ign
  // Mémoire des tuiles vides.
  const memo = new EmptyMemo();
  // Test de vide branché sur cette mémoire.
  const isEmpty = (s, tz, tx, ty) => memo.isEmpty(s.id, tz, tx, ty, s.minZoom);
  // Première tentative : la Suisse.
  assert.equal(nextAttempt(SOURCES, z, x, y, { isEmpty }).source.id, 'ch');
  // La Suisse est notée vide pour cette tuile.
  memo.mark('ch', z, x, y);
  // Tentative suivante : l'IGN.
  assert.equal(nextAttempt(SOURCES, z, x, y, { isEmpty }).source.id, 'ign');
  // L'IGN est noté vide à partir du niveau 12.
  memo.mark('ign', 12, x >> 5, y >> 5); // vide dès le niveau 12 : toutes les descendantes sautent l'IGN
  // Tentative suivante.
  const a = nextAttempt(SOURCES, z, x, y, { isEmpty });
  // Niveau 17 : rien. Niveau 16 : la Suisse couvre encore l'ancêtre (seule la tuile de niveau 17 a été vue vide).
  // La Suisse, par l'ancêtre de niveau 16.
  assert.deepEqual([a.source.id, a.z, a.depth], ['ch', 16, 1]);
  // La Suisse est notée vide à partir du niveau 12.
  memo.mark('ch', 12, x >> 5, y >> 5);
  // Tentative suivante.
  const b = nextAttempt(SOURCES, z, x, y, { isEmpty });
  // Sentinel-2, par l'ancêtre de niveau 14.
  assert.deepEqual([b.source.id, b.z, b.depth], ['sentinel2', 14, 3]);
// Fin du test.
});

// Test : le recours au relais du serveur.
test('source non chargeable d’ici ou en panne en direct : relais du serveur', () => {
  // Tuile de Munich au niveau 17.
  const [z, x, y] = tileAt(11.58, 48.14, 17); // Munich : service WMS de Bavière
  // La première source n'a pas d'adresse directe : relais.
  assert.deepEqual(nextAttempt(SOURCES, z, x, y), { kind: 'relay' });
  // Tuile de Paris au niveau 17.
  const paris = tileAt(2.35, 48.85, 17);
  // L'IGN étant coupé : relais.
  assert.deepEqual(nextAttempt(SOURCES, ...paris, { usable: (id) => id !== 'ign' }), { kind: 'relay' });
  // Aucune source jusqu'à 6 niveaux au-dessus : relais.
  // Au Caire au niveau 19, avec GIBS seul : relais.
  assert.deepEqual(nextAttempt([SOURCES[4]], ...tileAt(31.24, 30.04, 19)), { kind: 'relay' });
// Fin du test.
});

// Test : la mémoire des tuiles vides.
test('mémoire des tuiles vides : valable pour les descendantes, bornée', () => {
  // Mémoire limitée à deux entrées.
  const memo = new EmptyMemo(2);
  // Une tuile suisse de niveau 12 est notée vide.
  memo.mark('ch', 12, 2130, 1450);
  // Une de ses descendantes au niveau 15 est vide.
  assert.equal(memo.isEmpty('ch', 15, 2130 * 8 + 3, 1450 * 8 + 5, 12), true);
  // Sa voisine ne l'est pas.
  assert.equal(memo.isEmpty('ch', 12, 2131, 1450, 12), false);
  // La même tuile pour l'IGN ne l'est pas.
  assert.equal(memo.isEmpty('ign', 12, 2130, 1450, 12), false);
  // Une deuxième tuile est notée.
  memo.mark('ch', 12, 1, 1);
  // Une troisième tuile est notée : la première sort de la mémoire.
  memo.mark('ch', 12, 2, 2);
  // La première tuile n'est plus notée vide.
  assert.equal(memo.isEmpty('ch', 12, 2130, 1450, 12), false);
// Fin du test.
});

// Test : la mémoire à durée limitée et la réussite récente.
test('tuiles absentes : oubliées après le délai, source qui vient de répondre reconnue', () => {
  // Horloge d'essai.
  let t = 0;
  // Mémoire de dix minutes, branchée sur cette horloge.
  const memo = new MissingMemo(600_000, () => t);
  // Une tuile de l'IGN est notée absente.
  memo.mark('ign', 13, 4107, 2755);
  // Elle est absente.
  assert.equal(memo.isEmpty('ign', 13, 4107, 2755, 12), true);
  // Sa tuile fille aussi.
  assert.equal(memo.isEmpty('ign', 14, 8214, 5510, 12), true);  // tuile fille
  // Sa voisine ne l'est pas.
  assert.equal(memo.isEmpty('ign', 13, 4108, 2755, 12), false); // tuile voisine
  // La même tuile pour une autre source non plus.
  assert.equal(memo.isEmpty('es', 13, 4107, 2755, 12), false);  // autre source
  // 599 secondes plus tard.
  t = 599_000;
  // Toujours absente.
  assert.equal(memo.isEmpty('ign', 13, 4107, 2755, 12), true);
  // À 600 secondes.
  t = 600_000;
  // Oubliée.
  assert.equal(memo.isEmpty('ign', 13, 4107, 2755, 12), false);
  // Coupe-circuit branché sur l'horloge.
  const b = new DirectBreaker(() => t);
  // L'IGN n'a pas réussi récemment.
  assert.equal(b.recent('ign'), false); // jamais répondu
  // L'IGN réussit.
  b.success('ign');
  // Réussite récente.
  assert.equal(b.recent('ign'), true);
  // 119 secondes plus tard.
  t += 119_000;
  // Encore récente.
  assert.equal(b.recent('ign'), true);
  // Deux secondes de plus.
  t += 2_000;
  // Plus récente.
  assert.equal(b.recent('ign'), false);
// Fin du test.
});

// Test : le coupe-circuit.
test('coupe-circuit : 5 échecs d’affilée, puis une attente qui double', () => {
  // Horloge d'essai.
  let t = 0;
  // Coupe-circuit branché sur cette horloge.
  const b = new DirectBreaker(() => t);
  // Quatre échecs.
  for (let i = 0; i < 4; i++) b.failure('ign');
  // L'IGN reste utilisable.
  assert.equal(b.usable('ign'), true);
  // Cinquième échec.
  b.failure('ign');
  // L'IGN est coupé.
  assert.equal(b.usable('ign'), false);
  // Une minute plus tard.
  t = 60_000;
  // Il est de nouveau utilisable.
  assert.equal(b.usable('ign'), true);
  // Cinq nouveaux échecs.
  for (let i = 0; i < 5; i++) b.failure('ign');
  // 119 secondes plus tard.
  t = 60_000 + 119_000;
  // Toujours coupé.
  assert.equal(b.usable('ign'), false);
  // À 120 secondes.
  t = 60_000 + 120_000;
  // De nouveau utilisable.
  assert.equal(b.usable('ign'), true);
  // Une réussite remet tout à zéro.
  b.success('ign');
  // Cinq nouveaux échecs.
  for (let i = 0; i < 5; i++) b.failure('ign');
  // Une minute plus tard.
  t += 60_000;
  // De nouveau utilisable.
  assert.equal(b.usable('ign'), true);
  // Une autre source n'a jamais été coupée.
  assert.equal(b.usable('ch'), true);
// Fin du test.
});

// Test : la détection d'une image vide.
test('image vide : blanche, noire ou transparente, pas une photo ni une mer colorée', () => {
  // pixels : une image unie de 16 pixels d'une couleur donnée.
  const pixels = (r, g, b, a = 255, n = 16) => Uint8ClampedArray.from({ length: 4 * n }, (_, i) => [r, g, b, a][i % 4]);
  // Blanche : vide.
  assert.equal(isBlankPixels(pixels(255, 255, 255)), true);
  // Noire : vide.
  assert.equal(isBlankPixels(pixels(0, 0, 0)), true);
  // Transparente : vide.
  assert.equal(isBlankPixels(pixels(120, 130, 90, 0)), true);
  // Bleue : pas vide.
  assert.equal(isBlankPixels(pixels(20, 60, 110)), false);
  // Image blanche.
  const photo = pixels(255, 255, 255);
  // Avec un pixel coloré.
  photo[0] = 40; photo[1] = 90; photo[2] = 30;
  // Pas vide.
  assert.equal(isBlankPixels(photo), false);
  // Image sans pixel : pas vide.
  assert.equal(isBlankPixels(new Uint8ClampedArray(0)), false);
// Fin du test.
});

// Test : la découpe d'une tuile dans son ancêtre.
test('découpe d’une tuile dans son ancêtre', () => {
  // Un niveau plus haut : le quart en haut à droite.
  assert.deepEqual(cropRect(256, 1, 5, 4), { sx: 128, sy: 0, sw: 128, sh: 128 });
  // Trois niveaux plus haut : un carré de 32 pixels.
  assert.deepEqual(cropRect(256, 3, 8 * 7 + 3, 8 * 2 + 5), { sx: 96, sy: 160, sw: 32, sh: 32 });
  // Deux niveaux plus haut, ancêtre de 512 pixels : un carré de 128 pixels.
  assert.deepEqual(cropRect(512, 2, 1, 2), { sx: 128, sy: 256, sw: 128, sh: 128 });
// Fin du test.
});

// Test : la validité d'un plan direct.
test('plan direct valide ou non', () => {
  // Les sources d'essai : valide.
  assert.equal(validPlan(SOURCES), true);
  // Liste vide : non.
  assert.equal(validPlan([]), false);
  // Plan absent : non.
  assert.equal(validPlan(null), false);
  // Source sans niveaux : non.
  assert.equal(validPlan([{ id: 'x' }]), false);
// Fin du test.
});

// Test : les sources nationales en vue de loin.
test('vue de loin : sources nationales entre leur niveau réduit et leur niveau natif', () => {
  // Sources d'essai pour la vue de loin (début).
  const far = [
    // La Suisse, avec un niveau réduit à 8.
    { ...SOURCES[0], lowZoom: 8 },
    // La Bavière, inchangée.
    SOURCES[1],                       // WMS : jamais en vue de loin
    // L'IGN, avec un niveau réduit à 8.
    { ...SOURCES[2], lowZoom: 8 },
    // Sentinel-2, inchangé.
    SOURCES[3],
  // Fin des sources.
  ];
  // À Berne au niveau 9 : la Suisse puis l'IGN.
  assert.deepEqual(ids(farCandidatesAt(far, ...tileAt(7.45, 46.95, 9))), ['ch', 'ign']);
  // À Paris au niveau 10 : l'IGN.
  assert.deepEqual(ids(farCandidatesAt(far, ...tileAt(2.35, 48.85, 10))), ['ign']);
  // À Paris au niveau 7 : aucune.
  assert.deepEqual(farCandidatesAt(far, ...tileAt(2.35, 48.85, 7)), []);   // au-dessus du niveau réduit
  // À Paris au niveau 12 : aucune.
  assert.deepEqual(farCandidatesAt(far, ...tileAt(2.35, 48.85, 12)), []);  // niveau natif : chemin habituel
  // Au Caire au niveau 9 : aucune.
  assert.deepEqual(farCandidatesAt(far, ...tileAt(31.24, 30.04, 9)), []);
// Fin du test.
});

// Test : les pixels sans image.
test('pixel sans image et part de pixels sans image', () => {
  // Blanc : sans image.
  assert.equal(blankLike(255, 255, 255, 255), true);
  // Noir : sans image.
  assert.equal(blankLike(0, 0, 0, 255), true);
  // Transparent : sans image.
  assert.equal(blankLike(90, 110, 70, 0), true);
  // Presque blanc, avec un canal à 249 : image.
  assert.equal(blankLike(250, 250, 249, 255), false);
  // Vert opaque : image.
  assert.equal(blankLike(90, 110, 70, 255), false);
  // Quatre pixels dont deux sans image : part de 0,5.
  assert.equal(blankRatio(Uint8ClampedArray.from([255, 255, 255, 255, 90, 110, 70, 255, 0, 0, 0, 255, 10, 20, 30, 255])), 0.5);
  // Aucun pixel : part de 1.
  assert.equal(blankRatio(new Uint8ClampedArray(0)), 1);
// Fin du test.
});

// Test : la mosaïque de deux couches.
test('mosaïque : la première couche qui a une image l’emporte, le fond reste ailleurs', () => {
  // Fond de trois pixels.
  const base = Uint8ClampedArray.from([1, 2, 3, 255, 1, 2, 3, 255, 1, 2, 3, 255]);
  // Première couche : une couleur, puis deux pixels blancs.
  const a = { data: Uint8ClampedArray.from([200, 100, 50, 255, 255, 255, 255, 255, 255, 255, 255, 255]) };
  // Seconde couche : un gris, une couleur, puis un pixel transparent.
  const b = { data: Uint8ClampedArray.from([9, 9, 9, 255, 60, 70, 80, 255, 0, 0, 0, 0]) };
  // Résultat : la première couche, puis la seconde, puis le fond.
  assert.deepEqual([...composeOver(base, [a, b])], [200, 100, 50, 255, 60, 70, 80, 255, 1, 2, 3, 255]);
// Fin du test.
});

// Test : la correction de couleur dans la mosaïque.
test('mosaïque : correction de couleur de la couche appliquée, valeurs bornées', () => {
  // Fond d'un pixel noir.
  const base = Uint8ClampedArray.from([0, 0, 0, 255]);
  // Couche avec un gain et un décalage.
  const layer = { data: Uint8ClampedArray.from([100, 200, 50, 255]), gain: [1.5, 1.5, 1], offset: [0.1, 0, -0.5] };
  // Résultat corrigé et borné entre 0 et 255.
  assert.deepEqual([...composeOver(base, [layer])], [176, 255, 0, 255]); // 100×1,5 + 25,5 ; 300 → 255 ; 50 − 127,5 → 0
// Fin du test.
});

// Test : l'abandon d'un niveau non servi.
test('niveau non servi : abandonné après 6 échecs sans réussite, jamais après une réussite', () => {
  // Garde-fou par niveau.
  const gate = new LevelGate();
  // Cinq échecs de l'IGN au niveau 8.
  for (let i = 0; i < 5; i++) gate.fail('ign', 8);
  // Encore utilisable.
  assert.equal(gate.usable('ign', 8), true);
  // Sixième échec.
  gate.fail('ign', 8);
  // Plus utilisable à ce niveau.
  assert.equal(gate.usable('ign', 8), false);
  // Toujours utilisable au niveau 9.
  assert.equal(gate.usable('ign', 9), true);
  // Une réussite d'une autre source au niveau 9.
  gate.ok('jp', 9);
  // Puis vingt échecs.
  for (let i = 0; i < 20; i++) gate.fail('jp', 9);
  // Elle reste utilisable.
  assert.equal(gate.usable('jp', 9), true);
// Fin du test.
});

// Test : le calcul du gain et du décalage.
test('couleurs : gain et décalage qui ramènent la source sur la référence', () => {
  // Référence = source × 0,8 + 0,05 (par canal, sur 0 … 1).
  // Pixels de la source et de la référence.
  const src = [], ref = [];
  // Dégradé de gris pour la source ; la référence vaut la source × 0,8 + 0,05.
  for (let v = 40; v <= 220; v += 4) { src.push(v, v, v, 255); const r = Math.round(v * 0.8 + 0.05 * 255); ref.push(r, r, r, 255); }
  // Mesures des couleurs.
  const stats = new ColorStats();
  // Les deux tableaux de pixels.
  const s = Uint8ClampedArray.from(src), r = Uint8ClampedArray.from(ref);
  // Sans mesure : pas de correction.
  assert.equal(stats.solve(), null);
  // Trois tuiles ajoutées, toutes comptées.
  for (let i = 0; i < 3; i++) assert.equal(stats.add(s, r), true);
  // Correction calculée.
  const t = stats.solve();
  // Gain de 0,8, à 0,01 près.
  assert.ok(Math.abs(t.gain[0] - 0.8) < 0.01, `gain ${t.gain[0]}`);
  // Décalage de 0,05, à 0,01 près.
  assert.ok(Math.abs(t.offset[0] - 0.05) < 0.01, `décalage ${t.offset[0]}`);
  // Gardé puis relu : même résultat.
  // Mesures relues depuis leur forme JSON.
  const again = new ColorStats(JSON.parse(JSON.stringify(stats)));
  // Même correction.
  assert.deepEqual(again.solve(), t);
  // Elles sont prêtes.
  assert.equal(again.ready, true);
// Fin du test.
});

// Test : les tuiles ignorées et les bornes.
test('couleurs : tuile presque sans endroit commun ignorée, corrections bornées', () => {
  // Mesures des couleurs.
  const stats = new ColorStats();
  // Image entièrement blanche.
  const white = Uint8ClampedArray.from({ length: 400 }, () => 255);
  // Photo d'essai.
  const photo = Uint8ClampedArray.from({ length: 400 }, (_, i) => (i % 4 === 3 ? 255 : 60 + (i % 90)));
  // La tuile est ignorée.
  assert.equal(stats.add(white, photo), false);
  // Aucune tuile mesurée.
  assert.equal(stats.samples, 0);
  // Source presque unie face à une référence très contrastée : le gain reste borné à 1,6.
  // Image presque unie.
  const flat = Uint8ClampedArray.from({ length: 400 }, (_, i) => (i % 4 === 3 ? 255 : 120 + (i % 3)));
  // Trois tuiles ajoutées.
  for (let i = 0; i < 3; i++) stats.add(flat, photo);
  // Le gain est borné à 1,6.
  assert.equal(stats.solve().gain[0], 1.6);
// Fin du test.
});

/** Vignette THUMB × THUMB : `blank(x, y)` dit si le bloc est sans image. */
// thumbOf : vignette dont chaque bloc est blanc ou coloré selon la fonction reçue (début).
function thumbOf(blank) {
  // Pixels de la vignette.
  const data = new Uint8ClampedArray(4 * THUMB * THUMB);
  // Remplit chaque bloc : blanc s'il est sans image, vert sinon.
  for (let y = 0; y < THUMB; y++) for (let x = 0; x < THUMB; x++) data.set(blank(x, y) ? [255, 255, 255, 255] : [90, 110, 70, 255], 4 * (y * THUMB + x));
  // Renvoie les pixels.
  return data;
// Fin de thumbOf.
}

// Test : la zone sans image.
test('zone sans image : blocs vides élargis à leurs voisins, null quand la tuile est pleine', () => {
  // Vignette pleine : null.
  assert.equal(blankZone(thumbOf(() => false)), null);
  // Zone d'une vignette dont la moitié droite est vide.
  const zone = blankZone(thumbOf((x) => x >= 8)); // moitié droite vide
  // La colonne 6 est hors de la zone.
  assert.equal(zone[0 * THUMB + 6], 0);
  // La colonne 7 y est.
  assert.equal(zone[0 * THUMB + 7], 1); // voisin du bord
  // Un bloc de la moitié vide y est.
  assert.equal(zone[5 * THUMB + 12], 1);
  // Zone d'une vignette dont seul le coin est vide.
  const corner = blankZone(thumbOf((x, y) => x === 0 && y === 0));
  // Le coin et ses trois voisins y sont ; le bloc suivant non.
  assert.deepEqual([corner[0], corner[1], corner[THUMB], corner[THUMB + 1], corner[2]], [1, 1, 1, 1, 0]);
// Fin du test.
});

// Test : les seuils élargis.
test('bord de couverture : seuils plus larges près du bord', () => {
  // Gris très clair : sans image au sens large.
  assert.equal(blankNear(240, 238, 236, 255), true);
  // Mais pas au sens strict.
  assert.equal(blankLike(240, 238, 236, 255), false);
  // Avec un canal à 200 : image.
  assert.equal(blankNear(200, 238, 236, 255), false);
  // Presque noir : sans image.
  assert.equal(blankNear(8, 8, 8, 255), true);
// Fin du test.
});

// Test : la pose d'une couche avec une zone sans image.
test('pose d’une couche : le fond ne reste que dans la zone sans image, un pixel blanc ailleurs est gardé', () => {
  // Image de 32 pixels, deux pixels par bloc.
  const size = 32, block = size / THUMB; // 2 px par bloc
  // Fond d'une couleur unie.
  const base = Uint8ClampedArray.from({ length: 4 * size * size }, (_, i) => [1, 2, 3, 255][i % 4]);
  // Couche d'une couleur unie.
  const data = Uint8ClampedArray.from({ length: 4 * size * size }, (_, i) => [90, 110, 70, 255][i % 4]);
  // at : indice d'un pixel.
  const at = (x, y) => 4 * (y * size + x);
  // Moitié droite sans image, avec une bavure gris clair sur la colonne du bord ; un toit blanc loin du bord.
  // Moitié droite de la couche : gris clair sur la première colonne, blanc ensuite.
  for (let y = 0; y < size; y++) for (let x = size / 2; x < size; x++) data.set(x === size / 2 ? [240, 240, 240, 255] : [255, 255, 255, 255], at(x, y));
  // Un pixel blanc dans la moitié gauche.
  data.set([255, 255, 255, 255], at(3, 3));
  // Zone sans image : la moitié droite.
  const zone = blankZone(thumbOf((x) => x >= 8));
  // Pose la couche sur le fond.
  composeZoned(base, { data }, zone, size);
  // À gauche : la couleur de la couche.
  assert.deepEqual([...base.slice(at(0, 0), at(0, 0) + 4)], [90, 110, 70, 255]);      // photo
  // Le pixel blanc de gauche est gardé.
  assert.deepEqual([...base.slice(at(3, 3), at(3, 3) + 4)], [255, 255, 255, 255]);    // toit blanc gardé (hors zone)
  // Sur la colonne grise : le fond.
  assert.deepEqual([...base.slice(at(16, 5), at(16, 5) + 4)], [1, 2, 3, 255]);        // bavure du bord : fond, pas de liseré
  // Dans la moitié vide : le fond.
  assert.deepEqual([...base.slice(at(30, 5), at(30, 5) + 4)], [1, 2, 3, 255]);        // hors couverture : fond
  // Deux pixels par bloc.
  assert.equal(block, 2);
  // Sans zone : la couche couvre tout.
  // Fond noir transparent.
  const all = Uint8ClampedArray.from({ length: 4 * size * size }, () => 0);
  // Pose la couche sans zone.
  composeZoned(all, { data }, null, size);
  // Dans la moitié droite : le blanc de la couche.
  assert.deepEqual([...all.slice(at(30, 5), at(30, 5) + 4)], [255, 255, 255, 255]);
// Fin du test.
});

// Test : la correction de couleur de pixels.
test('correction de couleur appliquée à des pixels, bornée', () => {
  // Un pixel corrigé et borné.
  assert.deepEqual([...applyGain(Uint8ClampedArray.from([100, 200, 50, 255]), [1.5, 1.5, 1], [0.1, 0, -0.5])], [176, 255, 0, 255]);
// Fin du test.
});
