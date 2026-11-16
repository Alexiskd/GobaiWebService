// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { BORDER_STYLE, COAST_STYLE, buildBorderSegments } from './bordersGeometry';

// Premier test : frontières et littoraux ne se confondent plus.
test('contours : frontières et littoraux ont des couleurs et des opacités différentes', () => {
  // Couleurs distinctes.
  assert.notEqual(BORDER_STYLE.color, COAST_STYLE.color);
  // Opacités distinctes, les littoraux restant plus discrets.
  assert.ok(COAST_STYLE.opacity < BORDER_STYLE.opacity);
// Fin du test.
});

// Deuxième test : aucun bleu clair dans les contours (retiré du rendu).
test('contours : aucun des deux styles n’est bleu', () => {
  // Pour chaque style, composantes rouge, vert et bleu.
  for (const { color } of [BORDER_STYLE, COAST_STYLE]) {
    // Extrait les trois composantes.
    const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
    // Le bleu ne domine pas le rouge ni le vert.
    assert.ok(b <= Math.max(r, g));
  // Fin de la boucle.
  }
// Fin du test.
});

// Troisième test : un segment de deux points produit une paire de points sur la sphère.
test('contours : une polyligne donne des segments sur la sphère unité', () => {
  // Une polyligne de deux points, sans antiméridien.
  const seg = buildBorderSegments([[0, 0, 1, 0]]);
  // Une paire de points, soit six nombres par segment.
  assert.equal(seg.length % 6, 0);
  assert.ok(seg.length >= 6);
  // Tous les points sont à distance 1 du centre.
  for (let i = 0; i < seg.length; i += 3) {
    assert.ok(Math.abs(Math.hypot(seg[i], seg[i + 1], seg[i + 2]) - 1) < 1e-5);
  // Fin de la boucle.
  }
// Fin du test.
});
