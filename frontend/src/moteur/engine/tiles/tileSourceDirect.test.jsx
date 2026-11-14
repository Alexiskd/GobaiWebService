// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe TileSource, la source d'images des tuiles, depuis tileSource.
import { TileSource } from './tileSource';

/** Tuile Web Mercator qui contient (lon, lat) au niveau z. */
// tileAt : la tuile qui contient une longitude et une latitude à un niveau (début).
function tileAt(lon, lat, z) {
  // Nombre de tuiles par côté, et latitude en radians.
  const n = 2 ** z, r = (lat * Math.PI) / 180;
  // Renvoie le niveau, la colonne et la ligne, par la formule de Mercator.
  return { z, x: Math.floor(((lon + 180) / 360) * n), y: Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n) };
// Fin de tileAt.
}

// Plan de chargement direct d'essai (début).
const DIRECT = [
  // La Suisse : niveaux 12 à 19, une emprise, une adresse directe.
  { id: 'ch', minZoom: 12, maxZoom: 19, bboxes: [[5.9, 45.8, 10.5, 47.85]], templates: ['https://ch/{z}/{x}/{y}.jpeg'] },
  // La Bavière : niveaux 12 à 19, une emprise, sans adresse directe.
  { id: 'de-by', minZoom: 12, maxZoom: 19, bboxes: [[8.95, 47.25, 13.85, 50.6]] },
  // L'IGN : niveaux 12 à 19, une emprise sur la France, une adresse directe.
  { id: 'ign', minZoom: 12, maxZoom: 19, bboxes: [[-5.5, 41.2, 9.8, 51.2]], templates: ['https://ign/{z}/{x}/{y}'] },
  // Sentinel-2 : niveaux 0 à 14, sans emprise, deux adresses directes.
  { id: 'sentinel2', minZoom: 0, maxZoom: 14, templates: ['https://eox/a/{z}/{y}/{x}.jpg', 'https://eox/b/{z}/{y}/{x}.jpg'] },
// Fin du plan.
];

/**
 * Source dont les téléchargements sont simulés : `respond(url)` renvoie une image factice ({ url, blank? }), ou lève.
 * Le canevas de découpe est simulé lui aussi (pas de navigateur dans les tests).
 */
// makeSource : source dont les téléchargements sont simulés par la fonction reçue (début).
function makeSource(respond, direct = DIRECT, { color = false } = {}) {
  // Source créée avec une fausse API, pour le calque « earth-hd ».
  const source = new TileSource({ api: { layer: async () => ({}) }, layerId: 'earth-hd' });
  // Sa description : l'adresse du relais, le niveau maximal et le plan direct.
  source.info = { urlTemplate: '/api/v1/tiles/earth/earth-hd/{z}/{x}/{y}', maxZoom: 19, direct };
  // État : prête.
  source.status = 'ready';
  // Chargement direct actif.
  source.directOn = true;
  // Accord des couleurs : selon l'option.
  source.colorOn = color;       // accord des couleurs : coupé sauf dans les tests qui le concernent
  // Aucune couleur gardée.
  source.savedColors = {};
  // Pixels simulés : ceux que porte l'image factice (`pixels`), sinon une photo quelconque.
  // pixels : les pixels portés par l'image factice, sinon une couleur unie.
  source.pixels = (img, size) => img.pixels?.(size) ?? solid(size, 90, 110, 70);
  // canvasFrom : un objet qui porte les pixels de la mosaïque.
  source.canvasFrom = (data) => ({ mosaic: data });
  // Adresses demandées.
  const asked = [];
  // sharedImage : note l'adresse et renvoie l'image simulée.
  source.sharedImage = async (url) => { asked.push(url); return respond(url); };
  // isBlank : vrai pour une image factice marquée vide.
  source.isBlank = (img) => Boolean(img.blank);
  // Renvoie la source et les adresses demandées.
  return { source, asked };
// Fin de makeSource.
}

/** Pixels RGBA unis d'une vignette de `size` px. */
// solid : pixels RGBA d'une couleur unie (début).
function solid(size, r, g, b, a = 255) {
  // Un tableau qui répète les quatre composantes.
  return Uint8ClampedArray.from({ length: 4 * size * size }, (_, i) => [r, g, b, a][i % 4]);
// Fin de solid.
}
/** Moitié gauche d'une couleur, moitié droite blanche (hors du territoire). */
// halfBlank : moitié gauche d'une couleur, moitié droite blanche (début).
function halfBlank(size, r, g, b) {
  // Image blanche.
  const data = solid(size, 255, 255, 255);
  // Colore la moitié gauche.
  for (let y = 0; y < size; y++) for (let x = 0; x < size / 2; x++) data.set([r, g, b, 255], 4 * (y * size + x));
  // Renvoie les pixels.
  return data;
// Fin de halfBlank.
}

// Journal des dessins du faux canevas.
const drawn = [];
// Faux document, posé dans l'environnement global (début).
globalThis.document = {
  // createElement : un faux canevas (début).
  createElement: () => ({
    // Sa largeur et sa hauteur.
    width: 0, height: 0,
    // Son contexte, dont drawImage note ses arguments.
    getContext: () => ({ drawImage: (...args) => drawn.push(args) }),
  // Fin du faux canevas.
  }),
// Fin du faux document.
};

// Test, asynchrone : une tuile de niveau natif.
test('tuile native : chargée chez le fournisseur, sans relais', async () => {
  // Source dont toutes les adresses répondent.
  const { source, asked } = makeSource((url) => ({ url }));
  // Tuile de Paris au niveau 17.
  const c = tileAt(2.35, 48.85, 17);
  // Charge son image.
  const img = await source.loadImage(c);
  // Elle vient de l'IGN.
  assert.equal(img.url, `https://ign/${c.z}/${c.x}/${c.y}`);
  // Une seule adresse a été demandée.
  assert.deepEqual(asked, [img.url]);
  // Un chargement direct, aucun relais.
  assert.deepEqual([source.stats.direct, source.stats.relay], [1, 0]);
// Fin du test.
});

// Test, asynchrone : une source nationale vide à cet endroit.
test('source nationale vide ici : la suivante, et plus jamais redemandée pour cette zone', async () => {
  // Source dont les images suisses sont vides.
  const { source, asked } = makeSource((url) => ({ url, blank: url.startsWith('https://ch/') }));
  // Tuile du côté français du lac Léman, au niveau 13.
  const c = tileAt(6.1, 46.3, 13); // côté français du lac Léman, dans le rectangle suisse
  // Charge son image.
  const img = await source.loadImage(c);
  // Elle vient de l'IGN.
  assert.equal(img.url, `https://ign/${c.z}/${c.x}/${c.y}`);
  // Deux adresses ont été demandées.
  assert.equal(asked.length, 2);
  // Une tuile fille du même endroit : la Suisse n'est plus interrogée.
  // Une tuile fille du même endroit.
  const child = { z: 14, x: c.x * 2, y: c.y * 2 };
  // Charge son image.
  await source.loadImage(child);
  // La troisième adresse demandée est celle de l'IGN.
  assert.equal(asked[2], `https://ign/14/${child.x}/${child.y}`);
  // Trois adresses en tout : la Suisse n'a pas été redemandée.
  assert.equal(asked.length, 3);
// Fin du test.
});

// Test, asynchrone : une tuile au-delà du niveau natif.
test('au-delà du niveau natif : ancêtre chargé en direct puis découpé', async () => {
  // Vide le journal des dessins.
  drawn.length = 0;
  // Source dont les images font 256 pixels.
  const { source, asked } = makeSource((url) => ({ url, naturalWidth: 256 }));
  // Tuile du Caire au niveau 17.
  const c = tileAt(31.24, 30.04, 17); // Le Caire : Sentinel-2 s'arrête au niveau 14
  // Charge son image.
  const img = await source.loadImage(c);
  // Seul l'ancêtre de niveau 14 a été demandé.
  assert.deepEqual(asked, [`https://eox/a/14/${c.y >> 3}/${c.x >> 3}.jpg`]);
  // L'image rendue fait 256 pixels.
  assert.equal(img.width, 256);
  // Un seul dessin.
  assert.equal(drawn.length, 1);
  // Ses rectangles de source et de destination.
  const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawn[0];
  // Source : le carré de 32 pixels de la tuile dans l'ancêtre.
  assert.deepEqual([sx, sy, sw, sh], [(c.x % 8) * 32, (c.y % 8) * 32, 32, 32]);
  // Destination : toute l'image de 256 pixels.
  assert.deepEqual([dx, dy, dw, dh], [0, 0, 256, 256]);
// Fin du test.
});

// Test, asynchrone : les deux variantes d'adresse.
test('variante d’adresse : la seconde prend le relais de la première, et reste préférée', async () => {
  // Source dont la variante « a » échoue.
  const { source, asked } = makeSource((url) => { if (url.includes('/a/')) throw new Error('404'); return { url }; });
  // Charge une tuile.
  const img = await source.loadImage({ z: 5, x: 3, y: 4 });
  // Elle vient de la variante « b ».
  assert.equal(img.url, 'https://eox/b/5/4/3.jpg');
  // Charge une tuile voisine.
  await source.loadImage({ z: 5, x: 4, y: 4 });
  // Trois adresses : « a » puis « b » pour la première tuile, « b » directement pour la seconde.
  assert.deepEqual(asked, ['https://eox/a/5/4/3.jpg', 'https://eox/b/5/4/3.jpg', 'https://eox/b/5/4/4.jpg']);
// Fin du test.
});

// Test, asynchrone : une source sans adresse directe.
test('service non chargeable d’ici (WMS) : relais du serveur', async () => {
  // Source dont toutes les adresses répondent.
  const { source, asked } = makeSource((url) => ({ url }));
  // Tuile de Munich au niveau 17.
  const c = tileAt(11.58, 48.14, 17); // Munich
  // Charge son image.
  const img = await source.loadImage(c);
  // Elle vient du relais du serveur.
  assert.equal(img.url, `/api/v1/tiles/earth/earth-hd/${c.z}/${c.x}/${c.y}`);
  // Une seule adresse a été demandée.
  assert.equal(asked.length, 1);
  // Aucun chargement direct, un relais.
  assert.deepEqual([source.stats.direct, source.stats.relay], [0, 1]);
// Fin du test.
});

// Test, asynchrone : les échecs en direct.
test('échec en direct : relais pour la tuile, puis source écartée après 5 échecs d’affilée', async () => {
  // Source dont l'IGN échoue toujours.
  const { source, asked } = makeSource((url) => { if (url.startsWith('https://ign/')) throw new Error('réseau'); return { url }; });
  // Tuile de Paris au niveau 17.
  const c = tileAt(2.35, 48.85, 17);
  // Cinq tuiles voisines (début).
  for (let i = 0; i < 5; i++) {
    // Charge l'image.
    const img = await source.loadImage({ ...c, x: c.x + i });
    // Elle vient du relais.
    assert.ok(img.url.startsWith('/api/v1/tiles/earth/'));
  // Fin de la boucle.
  }
  // L'IGN a été demandé cinq fois.
  assert.equal(asked.filter((u) => u.startsWith('https://ign/')).length, 5);
  // Sixième tuile : l'IGN n'est plus essayé en direct, le relais répond tout de suite.
  // Charge une sixième tuile.
  await source.loadImage({ ...c, x: c.x + 5 });
  // L'IGN n'a pas été redemandé.
  assert.equal(asked.filter((u) => u.startsWith('https://ign/')).length, 5);
// Fin du test.
});

// Test, asynchrone : une tuile absente chez une source qui fonctionne.
test('tuile absente chez une source qui fonctionne (mer, pays voisin) : source suivante en direct, source jamais coupée', async () => {
  // L'IGN sert Paris mais répond par une erreur immédiate (404) en mer, dans son emprise rectangulaire.
  // Tuile de mer dans la Manche, au niveau 13.
  const sea = tileAt(0.49, 50.65, 13); // Manche, au large de la Picardie
  // Adresses qui échouent.
  const failing = new Set();
  // Source d'essai (début).
  const { source, asked } = makeSource((url) => {
    // Une adresse de l'IGN notée en échec lève une erreur.
    if (url.startsWith('https://ign/') && failing.has(url)) throw new Error('Tuile indisponible');
    // Les autres répondent.
    return { url };
  // Fin de la source.
  });
  // Tuile de Paris au niveau 13.
  const paris = tileAt(2.35, 48.85, 13);
  // Elle vient de l'IGN.
  assert.equal((await source.loadImage(paris)).url, `https://ign/13/${paris.x}/${paris.y}`);
  // Dix tuiles de mer d'affilée : chacune vient de la mosaïque mondiale, en direct, sans passer par le relais.
  // Dix tuiles de mer (début).
  for (let i = 0; i < 10; i++) {
    // La tuile.
    const c = { ...sea, x: sea.x - i };
    // Son adresse à l'IGN est notée en échec.
    failing.add(`https://ign/13/${c.x}/${c.y}`);
    // Charge son image.
    const img = await source.loadImage(c);
    // Elle vient de Sentinel-2, en direct.
    assert.equal(img.url, `https://eox/a/13/${c.y}/${c.x}.jpg`);
  // Fin de la boucle.
  }
  // Aucun relais.
  assert.equal(source.stats.relay, 0);
  // L'IGN n'est pas coupé.
  assert.equal(source.directBreaker.usable('ign'), true);
  // Paris est toujours servi par l'IGN.
  // Une tuile voisine de Paris.
  const next = { ...paris, x: paris.x + 1 };
  // Elle vient de l'IGN.
  assert.equal((await source.loadImage(next)).url, `https://ign/13/${next.x}/${next.y}`);
  // Une tuile fille d'une tuile de mer : l'IGN n'est pas redemandé pour elle.
  // Nombre de demandes à l'IGN jusqu'ici.
  const before = asked.filter((u) => u.startsWith('https://ign/')).length;
  // Charge une tuile fille d'une tuile de mer.
  await source.loadImage({ z: 14, x: sea.x * 2, y: sea.y * 2 });
  // Aucune demande de plus à l'IGN.
  assert.equal(asked.filter((u) => u.startsWith('https://ign/')).length, before);
// Fin du test.
});

// Test, asynchrone : le délai dépassé.
test('délai dépassé : toujours une panne, même pour une source qui vient de répondre', async () => {
  // Interrupteur de lenteur.
  let slow = false;
  // Source d'essai (début).
  const { source } = makeSource((url) => {
    // Avec l'interrupteur, l'IGN lève une erreur de délai dépassé.
    if (slow && url.startsWith('https://ign/')) throw Object.assign(new Error('Délai dépassé'), { name: 'TimeoutError' });
    // Sinon l'adresse répond.
    return { url };
  // Fin de la source.
  });
  // Tuile de Paris au niveau 17.
  const c = tileAt(2.35, 48.85, 17);
  // Un premier chargement réussit.
  await source.loadImage(c);
  // Lève l'interrupteur.
  slow = true;
  // Cinq tuiles voisines viennent du relais.
  for (let i = 1; i <= 5; i++) assert.ok((await source.loadImage({ ...c, x: c.x + i })).url.startsWith('/api/v1/tiles/earth/'));
  // L'IGN est coupé.
  assert.equal(source.directBreaker.usable('ign'), false);
// Fin du test.
});

// Test, asynchrone : l'annulation.
test('annulation : pas de repli sur le relais', async () => {
  // Source dont tout chargement est annulé.
  const { source } = makeSource(() => { throw Object.assign(new Error('annulé'), { name: 'AbortError' }); });
  // Le chargement est rejeté avec une erreur AbortError.
  await assert.rejects(source.loadImage(tileAt(2.35, 48.85, 17)), { name: 'AbortError' });
  // Aucun relais.
  assert.equal(source.stats.relay, 0);
// Fin du test.
});

// Test, asynchrone : sans chargement direct.
test('sans plan direct, ou chargement direct coupé : tout passe par le relais, comme avant', async () => {
  // Source sans plan direct.
  const none = makeSource((url) => ({ url }), null);
  // Tuile de Paris au niveau 17.
  const c = tileAt(2.35, 48.85, 17);
  // Elle vient du relais.
  assert.ok((await none.source.loadImage(c)).url.startsWith('/api/v1/tiles/earth/'));
  // Source avec un plan direct.
  const off = makeSource((url) => ({ url }));
  // Chargement direct coupé.
  off.source.directOn = false;
  // La tuile vient du relais.
  assert.ok((await off.source.loadImage(c)).url.startsWith('/api/v1/tiles/earth/'));
  // Les compteurs de direct et de relais restent à 0.
  assert.deepEqual([off.source.stats.direct, off.source.stats.relay], [0, 0]);
// Fin du test.
});

// ------------------------------------------------------------------ vue de loin et couleurs

// Plan direct d'essai pour la vue de loin (début).
const FAR = [
  // La Suisse, avec un niveau réduit à 8.
  { id: 'ch', minZoom: 12, maxZoom: 19, lowZoom: 8, bboxes: [[5.9, 45.8, 10.5, 47.85]], templates: ['https://ch/{z}/{x}/{y}.jpeg'] },
  // L'IGN, avec un niveau réduit à 8.
  { id: 'ign', minZoom: 12, maxZoom: 19, lowZoom: 8, bboxes: [[-5.5, 41.2, 9.8, 51.2]], templates: ['https://ign/{z}/{x}/{y}'] },
  // Sentinel-2.
  { id: 'sentinel2', minZoom: 0, maxZoom: 14, templates: ['https://eox/{z}/{y}/{x}.jpg'] },
// Fin du plan.
];

// Test, asynchrone : une tuile de loin entièrement couverte.
test('vue de loin : tuile entièrement couverte par la source nationale, rendue telle quelle', async () => {
  // Source dont toutes les adresses répondent.
  const { source, asked } = makeSource((url) => ({ url }), FAR);
  // Tuile du centre de la France au niveau 9.
  const c = tileAt(2.35, 47.0, 9); // centre de la France
  // Charge son image.
  const img = await source.loadImage(c);
  // Elle vient de l'IGN.
  assert.equal(img.url, `https://ign/${c.z}/${c.x}/${c.y}`);
  // Une seule adresse a été demandée.
  assert.deepEqual(asked, [img.url]); // l'image du monde n'est même pas demandée
// Fin du test.
});

// Test, asynchrone : une tuile de loin à cheval sur la frontière.
test('vue de loin : tuile à cheval sur la frontière, source nationale posée sur l’image du monde', async () => {
  // Source d'essai : pour l'IGN,
  const { source, asked } = makeSource((url) => (url.startsWith('https://ign/')
    // une image à moitié blanche ;
    ? { url, pixels: (size) => halfBlank(size, 40, 80, 30) }
    // pour les autres, une image bleue unie.
    : { url, pixels: (size) => solid(size, 10, 20, 200) }), FAR);
  // Tuile de la pointe de la Bretagne au niveau 9.
  const c = tileAt(-4.9, 48.4, 9); // pointe de la Bretagne : terre à l'est, rien à l'ouest pour la source
  // Charge son image.
  const out = await source.loadImage(c);
  // Deux adresses demandées : l'IGN puis Sentinel-2.
  assert.deepEqual(asked, [`https://ign/${c.z}/${c.x}/${c.y}`, `https://eox/${c.z}/${c.y}/${c.x}.jpg`]);
  // Pixels de la mosaïque rendue.
  const px = out.mosaic;
  // Premier pixel : la couleur de l'IGN.
  assert.deepEqual([...px.slice(0, 4)], [40, 80, 30, 255]);                       // moitié gauche : source nationale
  // Dernier pixel de la première ligne : la couleur de Sentinel-2.
  assert.deepEqual([...px.slice(4 * 255, 4 * 256)], [10, 20, 200, 255]);          // moitié droite : image du monde
// Fin du test.
});

// Test, asynchrone : une source vide en vue de loin.
test('vue de loin : source vide ici → image du monde, sans redemander la source pour les tuiles voisines plus fines', async () => {
  // Source dont les images de l'IGN sont entièrement blanches.
  const { source, asked } = makeSource((url) => (url.startsWith('https://ign/') ? { url, pixels: (size) => solid(size, 255, 255, 255) } : { url }), FAR);
  // Tuile d'Allemagne au niveau 9.
  const c = tileAt(8.5, 50.5, 9); // Allemagne, dans le rectangle français
  // Charge son image.
  const img = await source.loadImage(c);
  // Elle vient de Sentinel-2.
  assert.equal(img.url, `https://eox/${c.z}/${c.y}/${c.x}.jpg`);
  // Charge une tuile fille au niveau 10.
  await source.loadImage({ z: 10, x: c.x * 2, y: c.y * 2 });
  // L'IGN n'a été demandé qu'une fois.
  assert.equal(asked.filter((u) => u.startsWith('https://ign/')).length, 1);
  // La mémoire de la vue de loin ne retire pas la source à son niveau natif.
  // Charge une descendante au niveau 12.
  await source.loadImage({ z: 12, x: c.x * 8, y: c.y * 8 });
  // L'IGN est demandé à ce niveau.
  assert.ok(asked.some((u) => u.startsWith('https://ign/12/')), 'la source est encore demandée à son niveau natif');
// Fin du test.
});

// Test, asynchrone : un niveau non servi en vue de loin.
test('vue de loin : niveau non servi par le fournisseur → abandonné après 6 échecs, sans toucher au niveau natif', async () => {
  // Source dont l'IGN échoue au niveau 9.
  const { source, asked } = makeSource((url) => { if (/^https:\/\/ign\/9\//.test(url)) throw new Error('404'); return { url }; }, FAR);
  // Tuile du centre de la France au niveau 9.
  const c = tileAt(2.35, 47.0, 9);
  // Sept tuiles voisines (début).
  for (let i = 0; i < 7; i++) {
    // Charge l'image.
    const img = await source.loadImage({ ...c, x: c.x + (i % 3), y: c.y + Math.floor(i / 3) });
    // Elle vient de Sentinel-2.
    assert.ok(img.url.startsWith('https://eox/9/'));
  // Fin de la boucle.
  }
  // L'IGN a été demandé six fois au niveau 9.
  assert.equal(asked.filter((u) => u.startsWith('https://ign/9/')).length, 6);
  // Charge une tuile au niveau 13.
  const near = await source.loadImage(tileAt(2.35, 47.0, 13));
  // Elle vient de l'IGN.
  assert.ok(near.url.startsWith('https://ign/13/'));
// Fin du test.
});

// Test, asynchrone : sous le niveau réduit.
test('sous le niveau réduit : image du monde seule', async () => {
  // Source dont toutes les adresses répondent.
  const { source, asked } = makeSource((url) => ({ url }), FAR);
  // Tuile du centre de la France au niveau 6.
  const c = tileAt(2.35, 47.0, 6);
  // Elle vient de Sentinel-2.
  assert.ok((await source.loadImage(c)).url.startsWith('https://eox/6/'));
  // Une seule adresse a été demandée.
  assert.equal(asked.length, 1);
// Fin du test.
});

// Test, asynchrone : l'accord des couleurs.
test('couleurs : la source nationale est accordée sur la mosaïque mondiale après trois mesures', async () => {
  // Source nationale plus claire et moins contrastée que la référence : valeurs 100 … 200 contre 50 … 250.
  // ramp : image en dégradé horizontal entre deux valeurs.
  const ramp = (lo, hi) => (size) => Uint8ClampedArray.from({ length: 4 * size * size }, (_, i) => (i % 4 === 3 ? 255 : lo + ((hi - lo) * (Math.floor(i / 4) % size)) / (size - 1)));
  // Source avec l'accord des couleurs : dégradé de 100 à 200 pour l'IGN, de 50 à 250 pour les autres.
  const { source } = makeSource((url) => (url.startsWith('https://ign/') ? { url, pixels: ramp(100, 200) } : { url, pixels: ramp(50, 250) }), FAR, { color: true });
  // Tuile du centre de la France au niveau 13.
  const c = tileAt(2.35, 47.0, 13);
  // Charge une première image.
  const first = await source.loadImage(c);
  // Son état de couleur.
  const st = first.__color;
  // Il existe.
  assert.ok(st, 'l’image porte l’état de couleur de sa source');
  // Gain de 1 pour l'instant.
  assert.deepEqual([...st.gain], [1, 1, 1]); // pas encore assez de mesures
  // Trois tuiles voisines (début).
  for (let i = 1; i <= 3; i++) {
    // Charge l'image.
    await source.loadImage({ ...c, x: c.x + i });
    // Laisse passer un tour de la boucle d'événements.
    await new Promise((r) => setTimeout(r, 0)); // laisse finir la mesure en arrière-plan
  // Fin de la boucle.
  }
  // Le gain vaut 1,6.
  assert.ok(Math.abs(st.gain[0] - 1.6) < 1e-6, `gain borné à 1,6 (obtenu ${st.gain[0]})`);
  // Le décalage est négatif.
  assert.ok(st.offset[0] < 0);
  // La tuile déjà chargée voit la correction : même tableau.
  // La première image partage le même tableau de gain.
  assert.equal(first.__color.gain, st.gain);
  // L'image du monde (référence) n'est pas corrigée.
  // Image d'une tuile du monde au niveau 5.
  const world = await source.loadImage(tileAt(100, 10, 5));
  // Elle n'a pas d'état de couleur.
  assert.equal(world.__color, undefined);
// Fin du test.
});

// Test, asynchrone : l'accord des couleurs coupé.
test('couleurs coupées : aucune mesure, aucune correction', async () => {
  // Source sans accord des couleurs.
  const { source, asked } = makeSource((url) => ({ url }), FAR);
  // Charge une image au niveau 13.
  const img = await source.loadImage(tileAt(2.35, 47.0, 13));
  // Elle n'a pas d'état de couleur.
  assert.equal(img.__color, undefined);
  // Une seule adresse a été demandée.
  assert.equal(asked.length, 1);
// Fin du test.
});

// ------------------------------------------------------------------ bords de couverture et contrôles évités

// Test, asynchrone : un trou au bord de la couverture.
test('niveau natif : trou au bord de la couverture comblé par la source suivante', async () => {
  // Source d'essai : pour l'IGN,
  const { source, asked } = makeSource((url) => (url.startsWith('https://ign/')
    // une image à moitié blanche ;
    ? { url, pixels: (size) => halfBlank(size, 40, 80, 30) }
    // pour les autres, une image bleue unie de 256 pixels.
    : { url, naturalWidth: 256, pixels: (size) => solid(size, 10, 20, 200) }), FAR);
  // Tuile de la côte bretonne au niveau 13.
  const c = tileAt(-4.78, 48.38, 13); // côte : la source nationale n'a pas d'image à l'est
  // Charge son image.
  const out = await source.loadImage(c);
  // Deux adresses demandées : l'IGN puis Sentinel-2.
  assert.deepEqual(asked, [`https://ign/${c.z}/${c.x}/${c.y}`, `https://eox/${c.z}/${c.y}/${c.x}.jpg`]);
  // Premier pixel : la couleur de l'IGN.
  assert.deepEqual([...out.mosaic.slice(0, 4)], [40, 80, 30, 255]);
  // Dernier pixel de la première ligne : la couleur de Sentinel-2.
  assert.deepEqual([...out.mosaic.slice(4 * 255, 4 * 256)], [10, 20, 200, 255]);
// Fin du test.
});

// Test, asynchrone : les contrôles de pixels évités.
test('intérieur du pays : une tuile vue pleine dispense ses descendantes de tout contrôle de pixels', async () => {
  // Source dont toutes les adresses répondent.
  const { source } = makeSource((url) => ({ url }), FAR);
  // Compteur de lectures de pixels.
  let reads = 0;
  // La fonction pixels d'origine.
  const pixels = source.pixels;
  // La remplace par une version qui compte les lectures.
  source.pixels = (...args) => { reads++; return pixels(...args); };
  // isBlank : vide si tous les octets de la vignette valent 255.
  source.isBlank = function isBlank(img) { return this.pixels(img, 16).every((v) => v === 255); };
  // Tuile du centre de la France au niveau 12.
  const c = tileAt(2.35, 47.0, 12);
  // Charge son image.
  await source.loadImage(c);
  // Des pixels ont été lus.
  assert.ok(reads > 0);
  // Remet le compteur à 0.
  reads = 0;
  // Charge une tuile fille au niveau 13.
  await source.loadImage({ z: 13, x: c.x * 2 + 1, y: c.y * 2 });
  // Charge une descendante au niveau 15.
  await source.loadImage({ z: 15, x: c.x * 8 + 5, y: c.y * 8 + 3 });
  // Aucune lecture de pixels.
  assert.equal(reads, 0);
  // Une tuile voisine, hors de la tuile vue pleine, est encore contrôlée.
  // Charge une tuile voisine, hors de la première.
  await source.loadImage({ z: 13, x: (c.x + 1) * 2, y: c.y * 2 });
  // Des pixels ont été lus.
  assert.ok(reads > 0);
// Fin du test.
});

// Test : l'emprise d'un calque.
test('emprise d’un calque : demandé seulement sur les tuiles qui la touchent, à partir de son niveau minimal', () => {
  // Source du calque « lidar-hd-mns ».
  const lidar = new TileSource({ api: { layer: async () => ({}) }, layerId: 'lidar-hd-mns' });
  // Sa description : niveaux 6 à 18 et une emprise sur la France.
  lidar.info = { urlTemplate: 'https://data.geopf.fr/wmts?TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', minZoom: 6, maxZoom: 18, bounds: [[-5.5, 41.2, 9.8, 51.2]] };
  // État : prête.
  lidar.status = 'ready';
  // Paris au niveau 12 : couvert.
  assert.equal(lidar.covers(tileAt(2.35, 48.85, 12)), true, 'Paris');
  // Paris au niveau 20 : couvert.
  assert.equal(lidar.covers(tileAt(2.35, 48.85, 20)), true, 'au-delà du niveau natif : tuile ancêtre agrandie');
  // Paris au niveau 5 : pas couvert.
  assert.equal(lidar.covers(tileAt(2.35, 48.85, 5)), false, 'sous le niveau minimal');
  // New York : pas couvert.
  assert.equal(lidar.covers(tileAt(-74, 40.7, 12)), false, 'New York');
  // Berlin : pas couvert.
  assert.equal(lidar.covers(tileAt(13.4, 52.5, 12)), false, 'Berlin');
  // Sans emprise (calque mondial, autre astre) : toujours demandé, comme avant.
  // Source d'un calque sans emprise.
  const world = new TileSource({ api: { layer: async () => ({}) }, layerId: 'noms' });
  // Sa description : niveaux 3 à 8.
  world.info = { urlTemplate: '/x/{z}/{x}/{y}', minZoom: 3, maxZoom: 8 };
  // Le niveau 0 est couvert.
  assert.equal(world.covers({ z: 0, x: 0, y: 0 }), true);
// Fin du test.
});
