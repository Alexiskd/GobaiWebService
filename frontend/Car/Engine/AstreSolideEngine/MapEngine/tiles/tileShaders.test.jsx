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
test('tuiles : filtrage anisotrope 16 sur tous les appareils, borné par la carte graphique', () => {
  // Ordinateur, carte qui permet 16 : 16.
  assert.equal(tileAnisotropy(DESKTOP_PROFILE, 16), 16);
  // Téléphone : même valeur.
  assert.equal(tileAnisotropy(HANDHELD_PROFILE, 16), 16);
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
