// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { SEA_DEEP_M, SEA_SHALLOW_M, blendSea, decodeTerrarium, seaMask, seaWeight } from './seafloorFusion.jsx';
// Importe le codage Terrarium d'une altitude, pour fabriquer des tuiles d'essai.
import { terrariumPixel } from '../ReliefEngine/relief.jsx';

// tile : une tuile Terrarium de `size` px dont chaque pixel vaut altitude(i, j).
function tile(size, altitude) {
  // Pixels RGBA.
  const px = new Uint8ClampedArray(size * size * 4);
  // Pour chaque pixel : sa couleur Terrarium, opaque.
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) px.set([...terrariumPixel(altitude(i, j)), 255], (j * size + i) * 4);
  // Renvoie les pixels.
  return px;
// Fin de tile.
}

// Test : la part des fonds selon la profondeur.
test('part des fonds : rien sur les côtes, tout au large', () => {
  // Terre et eau peu profonde : rien.
  assert.equal(seaWeight(120), 0); assert.equal(seaWeight(-5), 0); assert.equal(seaWeight(SEA_SHALLOW_M), 0);
  // Large : tout.
  assert.equal(seaWeight(SEA_DEEP_M), 1); assert.equal(seaWeight(-4000), 1);
  // À mi-chemin : la moitié.
  assert.equal(seaWeight((SEA_SHALLOW_M + SEA_DEEP_M) / 2), 0.5);
  // Valeur absente : rien.
  assert.equal(seaWeight(NaN), 0);
// Fin du test.
});

// Test : décodage Terrarium.
test('décode les altitudes Terrarium, profondeurs comprises', () => {
  // Tuile de 2 px : 1 200 m, −3 500 m, 0 m, −20 m.
  const values = [1200, -3500, 0, -20];
  // Décodée.
  const elev = decodeTerrarium(tile(2, (i, j) => values[j * 2 + i]));
  // Les mêmes altitudes.
  assert.deepEqual([...elev], values);
// Fin du test.
});

// Test : pas de mer, pas de masque.
test('sans mer, aucune image des fonds n’est demandée', () => {
  // Tuile de terre à 300 m.
  const elev = decodeTerrarium(tile(8, () => 300));
  // Masque absent, au même niveau et pour une tuile fille.
  assert.equal(seaMask(elev, 0, 0, 0, 8), null); assert.equal(seaMask(elev, 2, 1, 3, 8), null);
// Fin du test.
});

// Test : côte, moitié ouest terre et moitié est mer profonde.
test('côte : la terre garde l’image satellite, le large prend les fonds', () => {
  // Tuile de 8 px : ouest à 100 m, est à −2 000 m.
  const elev = decodeTerrarium(tile(8, (i) => (i < 4 ? 100 : -2000)));
  // Masque au même niveau.
  const mask = seaMask(elev, 0, 0, 0, 8);
  // Bord ouest : satellite ; bord est : fonds.
  assert.equal(mask[0], 0); assert.equal(mask[7], 1);
  // Tuile fille au nord-est (niveau suivant, x = 1, y = 0) : entièrement au large.
  assert.ok(seaMask(elev, 1, 1, 0, 8).every((w) => w === 1));
  // Tuile fille au nord-ouest : à terre, sauf la frange de la côte.
  assert.equal(seaMask(elev, 1, 0, 0, 8)[0], 0);
// Fin du test.
});

// Test : mélange.
test('mélange les deux images selon la part des fonds', () => {
  // Deux pixels satellite : gris foncé.
  const out = new Uint8ClampedArray([40, 40, 40, 255, 40, 40, 40, 255]);
  // Deux pixels des fonds : bleu.
  const sea = new Uint8ClampedArray([0, 0, 200, 255, 0, 0, 200, 255]);
  // Premier pixel : rien ; second : moitié.
  blendSea(out, sea, new Float32Array([0, 0.5]));
  // Premier inchangé ; second à mi-chemin.
  assert.deepEqual([...out], [40, 40, 40, 255, 20, 20, 120, 255]);
// Fin du test.
});
