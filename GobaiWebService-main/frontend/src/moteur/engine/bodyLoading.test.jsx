// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import {
  LOD, MAX_TILED_BODIES, SAT_HIDE_PX, SAT_SHOW_PX, TILE_MIN_PX,
  apparentPx, bodyLevel, pixelScale, planTiledBodies, satelliteShown, sphereInView, viewConeHalfAngle,
} from './bodyLoading';

// Degrés en radians.
const D = Math.PI / 180;

// Premier test : la taille apparente suit la distance.
test('chargement : la taille apparente double quand la distance est divisée par deux', () => {
  // Échelle d'un écran de 1 000 px de haut, champ de 45°.
  const s = pixelScale(1000, 45 * D);
  // Vérifie le rapport de deux.
  assert.ok(Math.abs(apparentPx(1, 50, s) / apparentPx(1, 100, s) - 2) < 1e-9);
  // Une distance nulle ne donne pas l'infini ni NaN.
  assert.ok(Number.isFinite(apparentPx(1, 0, s)));
// Fin du test.
});

// Deuxième test : le cône de vue.
test('chargement : une sphère est dans le champ devant la caméra, hors champ derrière', () => {
  // Cône d'un champ de 45° sur un écran 16/9.
  const half = viewConeHalfAngle(45 * D, 16 / 9);
  // Visée vers -z.
  const dir = [0, 0, -1];
  // Droit devant : visible.
  assert.equal(sphereInView([0, 0, -100], dir, 1, half), true);
  // Derrière : hors champ.
  assert.equal(sphereInView([0, 0, 100], dir, 1, half), false);
  // Sur le côté à 90° : hors champ.
  assert.equal(sphereInView([100, 0, 0], dir, 1, half), false);
  // Sur le côté, mais si grosse qu'elle déborde dans le champ : visible.
  assert.equal(sphereInView([100, 0, 0], dir, 90, half), true);
  // Caméra dans la sphère : visible.
  assert.equal(sphereInView([0, 0, 5], dir, 10, half), true);
  // Au coin de l'écran (angle juste sous le demi-angle du cône) : visible.
  assert.equal(sphereInView([Math.sin(half - 0.01) * 100, 0, -Math.cos(half - 0.01) * 100], dir, 0.001, half), true);
// Fin du test.
});

// Troisième test : les niveaux de détail.
test('chargement : le niveau suit le champ, la taille et l’astre visé', () => {
  // Hors champ : rien.
  assert.equal(bodyLevel({ px: 500, inView: false, focused: false }), LOD.CULLED);
  // Minuscule : un point.
  assert.equal(bodyLevel({ px: 0.1, inView: true, focused: false }), LOD.POINT);
  // Petit disque : sphère.
  assert.equal(bodyLevel({ px: TILE_MIN_PX - 0.1, inView: true, focused: false }), LOD.SPHERE);
  // Au seuil : tuiles.
  assert.equal(bodyLevel({ px: TILE_MIN_PX, inView: true, focused: false }), LOD.TILES);
  // Visé, même minuscule et hors champ : tuiles.
  assert.equal(bodyLevel({ px: 0.01, inView: false, focused: true }), LOD.TILES);
// Fin du test.
});

// Quatrième test : le budget d'astres à tuiles.
test('chargement : l’astre visé passe d’abord, puis les plus grands, dans la limite du budget', () => {
  // Cinq astres au niveau des tuiles, un au niveau de la sphère.
  const c = [
    // L'astre visé, petit.
    { id: 'io', px: 4, level: LOD.TILES, focused: true },
    // Quatre autres, de tailles différentes.
    { id: 'jupiter', px: 300, level: LOD.TILES }, { id: 'europa', px: 9, level: LOD.TILES },
    { id: 'ganymede', px: 12, level: LOD.TILES }, { id: 'callisto', px: 5, level: LOD.TILES },
    // Un astre trop petit pour une carte.
    { id: 'mars', px: 1, level: LOD.SPHERE },
  // Fin de la liste.
  ];
  // Budget par défaut : l'astre visé et les deux plus grands, plus un des suivants (ici Europe, à l'image 0).
  assert.deepEqual([...planTiledBodies(c)].sort(), ['europa', 'ganymede', 'io', 'jupiter']);
  // À l'image suivante, c'est le tour de Callisto.
  assert.deepEqual([...planTiledBodies(c, MAX_TILED_BODIES, 1)].sort(), ['callisto', 'ganymede', 'io', 'jupiter']);
  // Sur deux images, les cinq astres ont été servis.
  assert.equal(new Set([...planTiledBodies(c, 3, 0), ...planTiledBodies(c, 3, 1)]).size, 5);
  // Le budget par défaut vaut trois.
  assert.equal(MAX_TILED_BODIES, 3);
  // Budget de un : l'astre visé, plus un des suivants (le plus grand, à l'image 0).
  assert.deepEqual([...planTiledBodies(c, 1)], ['io', 'jupiter']);
  // Budget nul : l'astre visé est servi quand même.
  assert.ok(planTiledBodies(c, 0).has('io'));
  // Aucun candidat au niveau des tuiles : plan vide.
  assert.equal(planTiledBodies([{ id: 'mars', px: 1, level: LOD.SPHERE }]).size, 0);
// Fin du test.
});

// Cinquième test : l'apparition des satellites.
test('chargement : un satellite apparaît quand son orbite se détache, sans clignoter au seuil', () => {
  // Orbite trop petite : caché.
  assert.equal(satelliteShown({ orbitPx: SAT_SHOW_PX - 1, focused: false, shown: false }), false);
  // Au seuil d'apparition : dessiné.
  assert.equal(satelliteShown({ orbitPx: SAT_SHOW_PX, focused: false, shown: false }), true);
  // Entre les deux seuils : garde son état précédent.
  assert.equal(satelliteShown({ orbitPx: SAT_HIDE_PX + 1, focused: false, shown: true }), true);
  // Sous le seuil de disparition : caché.
  assert.equal(satelliteShown({ orbitPx: SAT_HIDE_PX - 1, focused: false, shown: true }), false);
  // Visé : toujours dessiné.
  assert.equal(satelliteShown({ orbitPx: 0, focused: true, shown: false }), true);
// Fin du test.
});
