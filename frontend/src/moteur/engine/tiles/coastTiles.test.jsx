// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Le lecteur d'octets et la lecture des lignes d'une géométrie.
import { Reader, readLines } from './vectorTile';
// Le test des segments qui longent un bord de la tuile.
import { isEdgeRun } from './roadStyle';

// Géométrie d'un carré 0,0 → 10,0 → 10,10 → 0,10, fermé : aller à, tracer jusqu'à (3 points), fermer.
// Commandes : (1 << 3) | 1 = 9 ; (3 << 3) | 2 = 26 ; (1 << 3) | 7 = 15. Déplacements en zigzag : 10 → 20, -10 → 19.
const SQUARE = Uint8Array.from([9, 0, 0, 26, 20, 0, 0, 20, 19, 0, 15]);

// Premier test : un polygone se referme sur son premier point.
test('littoraux : un anneau de polygone revient à son premier point', () => {
  // Lit le carré comme un polygone.
  const [ring] = readLines(new Reader(SQUARE), true);
  // Cinq points : les quatre coins, puis le premier à nouveau.
  assert.deepEqual([...ring.points], [0, 0, 10, 0, 10, 10, 0, 10, 0, 0]);
  // Boîte englobante du carré.
  assert.deepEqual(ring.box, [0, 0, 10, 10]);
// Fin du test.
});

// Deuxième test : lu comme une ligne, le même tracé ne se referme pas (routes inchangées).
test('littoraux : sans fermeture, une ligne garde ses seuls points', () => {
  // Lit le même tracé comme une ligne.
  const [line] = readLines(new Reader(SQUARE));
  // Quatre points, sans retour au départ.
  assert.deepEqual([...line.points], [0, 0, 10, 0, 10, 10, 0, 10]);
// Fin du test.
});

// Troisième test : les segments du découpage de la tuile ne sont pas des littoraux.
test('littoraux : un segment qui longe un bord de la tuile est écarté', () => {
  // Étendue habituelle d'une tuile vectorielle.
  const E = 4096;
  // Bord gauche, bord droit, bord haut, bord bas : écartés.
  assert.equal(isEdgeRun(0, 10, 0, 300, E), true);
  assert.equal(isEdgeRun(E, 10, E, 300, E), true);
  assert.equal(isEdgeRun(10, 0, 300, 0, E), true);
  assert.equal(isEdgeRun(10, E, 300, E, E), true);
  // Au-delà du bord (tampon de la tuile) : écarté aussi.
  assert.equal(isEdgeRun(-64, 10, -64, 300, E), true);
  // Segment vertical à l'intérieur : gardé.
  assert.equal(isEdgeRun(100, 10, 100, 300, E), false);
  // Segment qui part du bord vers l'intérieur : gardé.
  assert.equal(isEdgeRun(0, 10, 50, 300, E), false);
// Fin du test.
});
