// Shader des tuiles et réglages de lecture des images (tileShaders.jsx, tileLayer.jsx). Lancer : npm test.
// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le shader de fragments des tuiles, depuis tileShaders.
import { tileFragmentShader } from './tileShaders.jsx';
// Importe imageSide, le côté d'une image de tuile, depuis tileLayer.
import { imageSide } from './tileLayer.jsx';

// Test : le côté d'une image.
test('image : côté lu sur l\'image, le canevas ou l\'ImageBitmap, 256 par défaut', () => {
  // Image de 512 px : sa largeur naturelle.
  assert.equal(imageSide({ naturalWidth: 512, width: 300 }), 512);
  // Canevas ou ImageBitmap (sans largeur naturelle) : sa largeur.
  assert.equal(imageSide({ width: 256 }), 256);
  // Image inconnue : 256.
  assert.equal(imageSide(null), 256);
  // Image sans dimensions : 256.
  assert.equal(imageSide({}), 256);
// Fin du test.
});

// Test : l'agrandissement lissé suit la vraie taille de l'image.
test('shader : agrandissement lissé sur la grille de l\'image (mapSize), plus aucune taille de 256 px en dur', () => {
  // La variable uniforme est déclarée.
  assert.match(tileFragmentShader, /uniform float mapSize;/);
  // La grille de l'agrandissement utilise la vraie taille.
  assert.match(tileFragmentShader, /\*mapSize;float ppt=/);
  // Le renfort des contours aussi.
  assert.match(tileFragmentShader, /float ue=1\.\/mapSize;/);
  // Plus aucune grille de 256 px en dur dans l'agrandissement.
  assert.doesNotMatch(tileFragmentShader, /\)\*256\.;float ppt=/);
// Fin du test.
});

// Test : l'ombrage estimé d'après l'image suit aussi sa vraie taille.
test('shader : ombrage par l\'image mesuré à 1,5 pixel de l\'image (mapSize)', () => {
  // L'écart de mesure utilise la vraie taille.
  assert.match(tileFragmentShader, /float e=1\.5\/mapSize;/);
  // Plus d'écart de 1,5/256 en dur.
  assert.doesNotMatch(tileFragmentShader, /1\.5\/256\./);
// Fin du test.
});

// Importe tileAnisotropy, le filtrage anisotrope des tuiles, depuis tileManager.
import { tileAnisotropy } from './tileManager.jsx';
// Importe les profils d'appareil, depuis powerSaver.
import { DESKTOP_PROFILE, HANDHELD_PROFILE } from '../../PerfEngine/powerSaver.jsx';

// Test : le filtrage anisotrope des tuiles.
test('tuiles : filtrage anisotrope 16 sur ordinateur, 8 sur téléphone haut de gamme, borné par la carte graphique', () => {
  // Ordinateur, carte qui permet 16 : 16.
  assert.equal(tileAnisotropy(DESKTOP_PROFILE, 16), 16);
  // Téléphone haut de gamme : 8 (moins de lectures de texture, moins de chauffe).
  assert.equal(tileAnisotropy(HANDHELD_PROFILE, 16), 8);
  // Carte limitée à 4 : 4.
  assert.equal(tileAnisotropy(DESKTOP_PROFILE, 4), 4);
  // Profil inconnu : 16, borné par la carte.
  assert.equal(tileAnisotropy(undefined, 8), 8);
  // Ancien profil sans valeur pour les tuiles : sa valeur générale.
  assert.equal(tileAnisotropy({ anisotropy: 8 }, 16), 8);
  // Carte sans filtrage anisotrope (0) : 1.
  assert.equal(tileAnisotropy(DESKTOP_PROFILE, 0), 1);
// Fin du test.
});

// Importe textureUploader, l'envoi immédiat des textures, depuis tileManager.
import { textureUploader } from './tileManager.jsx';
// Importe TileLayer, la couche de tuiles, depuis tileLayer.
import { TileLayer } from './tileLayer.jsx';

// Test : l'envoi immédiat des textures.
test('tuiles : texture envoyée à la carte graphique dès sa création, une seule fois par image partagée', () => {
  // Textures envoyées.
  const sent = [];
  // Faux moteur de rendu qui note chaque envoi.
  const uploader = textureUploader({ initTexture: (t) => sent.push(t) });
  // Moteur de rendu sans initTexture : pas d'envoi immédiat.
  assert.equal(textureUploader({}), null);
  // Couche minimale (début) :
  const layer = new TileLayer({
    // repère, source, variables partagées et envoi immédiat.
    root: { add() {} }, source: { minZoom: 0, maxZoom: 5 }, uniforms: {}, initTexture: uploader,
  // Fin de la couche.
  });
  // Fausse image de 256 px.
  const img = { width: 256, height: 256 };
  // Première texture : envoyée.
  const t = layer.texture(img);
  // Même image : la texture partagée, pas de second envoi.
  assert.equal(layer.texture(img), t);
  // Un seul envoi, de cette texture.
  assert.deepEqual(sent, [t]);
  // Un envoi qui échoue (contexte perdu) ne casse pas la mise en place.
  const broken = new TileLayer({ root: { add() {} }, source: { minZoom: 0, maxZoom: 5 }, uniforms: {}, initTexture: () => { throw new Error('perdu'); } });
  // La texture est quand même rendue.
  assert.ok(broken.texture({ width: 256, height: 256 }));
// Fin du test.
});

// Importe le budget de mise en place, depuis tileLayer.
import { UPLOAD_BUDGET_MS, uploadAllowed } from './tileLayer.jsx';

// Test : le budget de mise en place par image.
test('tuiles : mises en place bornées en nombre et en millisecondes, la première passe toujours', () => {
  // Budgets : 2 ms sur téléphone, 4 ms sur ordinateur.
  assert.deepEqual(UPLOAD_BUDGET_MS, { desktop: 4, handheld: 2 });
  // La première passe même si le temps est déjà dépassé.
  assert.equal(uploadAllowed(0, 50, 8, 2), true);
  // Aucune permise : aucune.
  assert.equal(uploadAllowed(0, 0, 0, 2), false);
  // Sous le nombre et sous le budget : encore une.
  assert.equal(uploadAllowed(3, 1.5, 8, 2), true);
  // Budget de temps atteint : stop.
  assert.equal(uploadAllowed(3, 2, 8, 2), false);
  // Nombre atteint : stop.
  assert.equal(uploadAllowed(8, 0.1, 8, 4), false);
// Fin du test.
});

// Importe refreshPriorities, le reclassement des tuiles arrivées, depuis tileLayer.
import { refreshPriorities } from './tileLayer.jsx';

// Test : les tuiles arrivées suivent la vue actuelle.
test('tuiles : arrivées reclassées d\'après la vue actuelle avant la mise en place', () => {
  // Trois tuiles arrivées : A était au centre (priorité 1), B au bord (9), C hors de la vue actuelle (5).
  const arrived = [{ key: 'A', d: 1 }, { key: 'B', d: 9 }, { key: 'C', d: 5 }];
  // La vue a tourné : B est au centre, A au bord ; C n'est plus voulue.
  const priorities = new Map([['A', 8], ['B', 0.5]]);
  // Reclassement puis tri.
  const order = refreshPriorities(arrived, priorities).sort((p, q) => p.d - q.d).map((a) => a.key);
  // B d'abord, puis C (priorité d'origine), puis A.
  assert.deepEqual(order, ['B', 'C', 'A']);
// Fin du test.
});

// Test : en hexagones, les maillages carrés invisibles partagent une géométrie vide.
test('tuiles : en hexagones, pas de quadrillage carré construit ; en tuiles carrées, quadrillage complet', () => {
  // Couche en hexagones (début) :
  const hexLayer = new TileLayer({
    // repère et source minimale (projection Mercator par défaut).
    root: { add() {}, remove() {} }, source: { minZoom: 0, maxZoom: 5, info: {} }, uniforms: {},
  // Fin de la couche.
  });
  // Fausse image.
  const img = () => ({ width: 256, height: 256 });
  // Deux tuiles mises en place.
  hexLayer.install({ key: '3/1/2', coord: { z: 3, x: 1, y: 2 }, base: img() });
  // Seconde tuile.
  hexLayer.install({ key: '3/2/2', coord: { z: 3, x: 2, y: 2 }, base: img() });
  // Leurs fiches.
  const a = hexLayer.ready('3/1/2'), b = hexLayer.ready('3/2/2');
  // Même géométrie, vide.
  assert.equal(a.mesh.geometry, b.mesh.geometry);
  // Sans sommets.
  assert.equal(a.mesh.geometry.getAttribute('position'), undefined);
  // Centre sur la sphère de rayon 1.
  assert.ok(Math.abs(Math.hypot(...a.center) - 1) < 1e-9);
  // Libérer une tuile ne détruit pas la géométrie partagée encore utilisée.
  hexLayer.cache.delete('3/1/2');
  // L'autre tuile la garde.
  assert.equal(hexLayer.ready('3/2/2').mesh.geometry, hexLayer.emptyGeometry);
  // Couche en tuiles carrées : quadrillage complet.
  const sq = new TileLayer({ root: { add() {}, remove() {} }, source: { minZoom: 0, maxZoom: 5, info: {} }, uniforms: {}, hex: false });
  // Une tuile.
  sq.install({ key: '3/1/2', coord: { z: 3, x: 1, y: 2 }, base: img() });
  // Elle a des sommets.
  assert.ok(sq.ready('3/1/2').mesh.geometry.getAttribute('position').count > 0);
// Fin du test.
});

// Test : en hexagones, aucune matrice de maillage carré n'est recalculée.
test('tuiles : en hexagones, les maillages carrés invisibles ne sont pas replacés', () => {
  // Couche en hexagones.
  const layer = new TileLayer({ root: { add() {}, remove() {} }, source: { minZoom: 0, maxZoom: 5, info: {} }, uniforms: {} });
  // Une tuile.
  layer.install({ key: '2/1/1', coord: { z: 2, x: 1, y: 1 }, base: { width: 256 } });
  // Sa fiche.
  const e = layer.ready('2/1/1');
  // Écart entre niveaux changé (zoom).
  layer.gap = 5e-7;
  // Placement demandé.
  layer.place(e);
  // Rien n'a bougé : l'écart noté sur la tuile n'a pas changé.
  assert.notEqual(e.gap, 5e-7);
  // En tuiles carrées, le placement se fait.
  const sq = new TileLayer({ root: { add() {}, remove() {} }, source: { minZoom: 0, maxZoom: 5, info: {} }, uniforms: {}, hex: false });
  // Une tuile.
  sq.install({ key: '2/1/1', coord: { z: 2, x: 1, y: 1 }, base: { width: 256 } });
  // Écart changé.
  sq.gap = 5e-7;
  // Placement.
  sq.place(sq.ready('2/1/1'));
  // L'écart est noté.
  assert.equal(sq.ready('2/1/1').gap, 5e-7);
// Fin du test.
});

// Test : fondu en tramage.
test('shader : fondu en tramage de Bayer 4 × 4, couleur toujours opaque', () => {
  // Trame déclarée.
  assert.match(tileFragmentShader, /float bayer4\(vec2 a\)/);
  // Pixels non dessinés selon la trame pendant un fondu.
  assert.match(tileFragmentShader, /if\(alpha<\.999&&alpha<=bayer4\(gl_FragCoord\.xy\)\)discard;/);
  // Couleur finale opaque.
  assert.match(tileFragmentShader, /gl_FragColor=vec4\(base,1\.\);\}$/);
  // Même trame en JavaScript : 16 seuils distincts entre 0 et 1 sur un carré de 4 × 4 pixels.
  const b2 = (x, y) => { x = Math.floor(x) % 2; y = Math.floor(y) % 2; return (x * 0.5 + y * y * 0.75) % 1; };
  // Trame 4 × 4.
  const b4 = (x, y) => b2(0.5 * x, 0.5 * y) * 0.25 + b2(x, y) + 0.03125;
  // Seuils du carré.
  const seen = new Set();
  // Pour chaque pixel du carré : seuil entre 0 et 1, noté.
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const v = b4(x + 0.5, y + 0.5); assert.ok(v > 0 && v < 1); seen.add(v.toFixed(5)); }
  // Seize seuils distincts : chaque palier d'opacité dessine un pixel de plus sur seize.
  assert.equal(seen.size, 16);
  // Coordonnées ramenées modulo 2 dans le shader (précision sur les grands écrans).
  assert.match(tileFragmentShader, /a=mod\(floor\(a\),2\.\)/);
  // Même trame loin du coin de l'écran (pixel 2 556) qu'au coin : motif périodique de 4 pixels.
  assert.equal(b4(2556.5, 1001.5), b4(0.5, 1.5));
// Fin du test.
});
