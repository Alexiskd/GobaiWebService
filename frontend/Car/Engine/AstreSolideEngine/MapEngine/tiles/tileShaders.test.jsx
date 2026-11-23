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
