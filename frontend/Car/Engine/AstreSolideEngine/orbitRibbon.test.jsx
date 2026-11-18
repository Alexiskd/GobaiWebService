// Importe le lanceur de tests de Node.
import { test } from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe les calculs purs du style des orbites.
import { ORBIT_STYLE, fract, loopTrailAlphas, nearestPointIndex, rgbaOf, tintColor, trailAlpha, windowTrailAlphas } from './orbitRibbonMath.jsx';

// Test : l'opacité de la traînée.
test('traînée : pleine juste derrière l’astre, faible devant, décroissante entre les deux', () => {
  // Juste derrière l'astre : l'opacité la plus forte.
  assert.equal(trailAlpha(0), ORBIT_STYLE.near);
  // Un tour complet en arrière (juste devant l'astre) : l'opacité la plus faible.
  assert.ok(Math.abs(trailAlpha(1) - ORBIT_STYLE.far) < 1e-12);
  // Décroissante.
  for (let d = 0; d < 1; d += 0.05) assert.ok(trailAlpha(d) >= trailAlpha(d + 0.05) - 1e-12, `d = ${d}`);
  // Jamais invisible.
  assert.ok(trailAlpha(1) > 0);
  // Bornée hors de [0, 1].
  assert.equal(trailAlpha(-1), trailAlpha(0)); assert.equal(trailAlpha(2), trailAlpha(1));
// Fin du test.
});

// Test : la part décimale.
test('fract : position sur un tour, toujours entre 0 et 1', () => {
  // Valeurs simples.
  assert.equal(fract(0.25), 0.25); assert.equal(fract(-0.25), 0.75); assert.equal(fract(3), 0);
// Fin du test.
});

// Test : la traînée d'une orbite fermée.
test('orbite fermée : la traînée suit le sens du mouvement, la boucle se referme', () => {
  // Huit segments, neuf points.
  const a = new Float32Array(9);
  // Astre au point 2, indices croissants.
  loopTrailAlphas(a, 2, 1);
  // Le plus clair : l'astre lui-même.
  assert.equal(Math.max(...a), a[2]);
  // Le point qu'il vient de quitter est plus clair que celui où il va.
  assert.ok(a[1] > a[3]);
  // Le dernier point répète le premier.
  assert.equal(a[8], a[0]);
  // Sens inverse : c'est l'inverse.
  loopTrailAlphas(a, 2, -1);
  // Le point d'où il vient (3) est plus clair que celui où il va (1).
  assert.ok(a[3] > a[1]);
// Fin du test.
});

// Test : la traînée d'un tracé centré sur l'astre.
test('tracé centré : traînée dans la moitié passée, bouts confondus de même opacité', () => {
  // Huit segments.
  const a = windowTrailAlphas(new Float32Array(9));
  // L'astre, au milieu : le plus clair.
  assert.equal(Math.max(...a), a[4]);
  // Un pas dans le passé est plus clair qu'un pas dans l'avenir.
  assert.ok(a[3] > a[5]);
  // Les deux bouts, confondus, ont la même opacité.
  assert.ok(Math.abs(a[0] - a[8]) < 1e-6);
// Fin du test.
});

// Test : le point le plus proche.
test('point le plus proche d’une position', () => {
  // Trois points sur l'axe x.
  const p = new Float32Array([0, 0, 0, 10, 0, 0, 20, 0, 0]);
  // Près du deuxième.
  assert.equal(nearestPointIndex(p, 3, 9, 1, 0), 1);
  // Près du troisième.
  assert.equal(nearestPointIndex(p, 3, 30, 0, 0), 2);
// Fin du test.
});

// Test : les couleurs.
test('couleurs : éclaircie vers le blanc, translucide en CSS', () => {
  // Sans blanc : inchangée.
  assert.equal(tintColor('#204060', 0), 0x204060);
  // Tout blanc : blanc.
  assert.equal(tintColor(0x204060, 1), 0xffffff);
  // À moitié : chaque composante à mi-chemin du blanc.
  assert.equal(tintColor('#000000', 0.5), 0x808080);
  // Couleur absente ou illisible : gris-bleu par défaut.
  assert.equal(tintColor(undefined, 0), 0x8fa3d0);
  // Couleur CSS translucide.
  assert.equal(rgbaOf('#ff8000', 0.5), 'rgba(255, 128, 0, 0.5)');
// Fin du test.
});
