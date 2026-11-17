// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { mercatorV, mosaicTiles } from './earthCloudMosaic';

// Test : les tuiles de la mosaïque.
test('mosaïque de nuages : 16 tuiles au niveau 2, rangées du nord-ouest au sud-est', () => {
  // Les tuiles du niveau 2.
  const tiles = mosaicTiles(2);
  // Il y en a 16.
  assert.equal(tiles.length, 16);
  // La première : en haut à gauche.
  assert.deepEqual(tiles[0], { x: 0, y: 0, left: 0, top: 0 });
  // La dernière : colonne 3, ligne 3, à 768 pixels du bord gauche et du haut.
  assert.deepEqual(tiles[15], { x: 3, y: 3, left: 768, top: 768 });
  // Au niveau 0 : une seule tuile.
  assert.equal(mosaicTiles(0).length, 1);
// Fin du test.
});

// Test : la conversion de la latitude.
test('mosaïque de nuages : latitude vers ordonnée de Mercator', () => {
  // L'équateur est à mi-hauteur.
  assert.ok(Math.abs(mercatorV(0) - 0.5) < 1e-12);
  // La latitude limite de la projection de Mercator, en radians.
  const edge = 85.0511287798 * Math.PI / 180;
  // Au nord, elle donne 1.
  assert.ok(Math.abs(mercatorV(edge) - 1) < 1e-9);
  // Au sud, elle donne 0.
  assert.ok(Math.abs(mercatorV(-edge)) < 1e-9);
  // Plus près du pôle : au-delà de 1.
  assert.ok(mercatorV(1.55) > 1); // près du pôle : hors de la mosaïque
// Fin du test.
});
