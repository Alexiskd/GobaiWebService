// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les fonctions testées du mouvement de la météo.
import { FLOW_PERIOD_S, FLOW_SPAN_S, WIND_TEXTURE_HEIGHT, WIND_TEXTURE_WIDTH, flowState, isWindGrid, modelWind, sampleWind, windTexels } from './weatherFlow';

// Test : le vent du modèle de circulation générale, selon la latitude.
test('vent modèle : alizés d’est à l’équateur, vents d’ouest vers 50°, symétrique', () => {
  // À l'équateur, la composante vers l'est est inférieure à −5 m/s : vent d'est.
  assert.ok(modelWind(0)[0] < -5);
  // À 50° de latitude, elle dépasse 10 m/s : vent d'ouest.
  assert.ok(modelWind(50)[0] > 10);
  // Même valeur à 50° nord et à 50° sud, à 1e-12 près.
  assert.ok(Math.abs(modelWind(50)[0] - modelWind(-50)[0]) < 1e-12);
  // À 80° de latitude, elle est inférieure à 2 m/s.
  assert.ok(modelWind(80)[0] < 2);
  // À 30° de latitude, la composante vers le nord est nulle.
  assert.equal(modelWind(30)[1], 0);
// Fin du test.
});

// Grille de vent d'essai : 4 colonnes (de −180° par pas de 90°), 3 lignes (de −60° par pas de 60°) ; u vaut 10, 20, 30, 40 sur la ligne du milieu et 0 ailleurs, v vaut −5 partout.
const grid = { width: 4, height: 3, latStart: -60, latStep: 60, lonStart: -180, lonStep: 90, u: [0, 0, 0, 0, 10, 20, 30, 40, 0, 0, 0, 0], v: Array(12).fill(-5) };

// Test : la lecture d'un point dans la grille.
test('grille de vent : interpolation, longitude qui boucle, latitude bornée', () => {
  // La grille d'essai est reconnue comme utilisable.
  assert.ok(isWindGrid(grid));
  // Sur un nœud de la grille (−180°, 0°) : la valeur exacte, 10 et −5.
  assert.deepEqual(sampleWind(grid, -180, 0), [10, -5]);
  // À mi-chemin entre les deux premières colonnes : 15, moyenne de 10 et 20.
  assert.deepEqual(sampleWind(grid, -135, 0), [15, -5]);
  // Entre la dernière colonne et la première : 25, moyenne de 40 et 10.
  assert.deepEqual(sampleWind(grid, 135, 0), [25, -5]);       // entre 90° (40) et -180° (10) : la grille boucle
  // À mi-chemin entre la ligne 0° et la ligne 60° : 5, moyenne de 10 et 0.
  assert.deepEqual(sampleWind(grid, -180, 30), [5, -5]);
  // À 89° de latitude : valeur de la dernière ligne, 0.
  assert.deepEqual(sampleWind(grid, -180, 89), [0, -5]);      // au-delà de la dernière ligne
  // Une grille dont le tableau u n'a pas la bonne longueur est refusée.
  assert.equal(isWindGrid({ ...grid, u: [1] }), false);
  // Une grille absente est refusée.
  assert.equal(isWindGrid(null), false);
// Fin du test.
});

// Test : la texture de vent envoyée au shader.
test('texture de vent : taille fixe, calme au milieu de l’échelle, grille réelle ou modèle', () => {
  // Texture construite sans grille : celle du modèle.
  const model = windTexels(null);
  // Sa longueur : largeur × hauteur × 4 octets.
  assert.equal(model.length, WIND_TEXTURE_WIDTH * WIND_TEXTURE_HEIGHT * 4);
  // row : indice du premier octet de la ligne y de la texture.
  const row = (y) => (y * WIND_TEXTURE_WIDTH) * 4;
  // Ligne 9, octet rouge (vers l'est) : inférieur à 127.
  assert.ok(model[row(9)] < 127);       // 5° N : vent d'est
  // Ligne 14, octet rouge : supérieur à 140.
  assert.ok(model[row(14)] > 140);      // 55° N : vent d'ouest
  // Ligne 9, octet vert (vers le nord) : 128, le milieu de l'échelle.
  assert.equal(model[row(9) + 1], 128); // pas de vent nord-sud dans le modèle
  // Texture construite avec la grille d'essai.
  const real = windTexels(grid);
  // Ligne 9, octet vert : inférieur à 127.
  assert.ok(real[row(9) + 1] < 127);    // vent vers le sud de la grille réelle
  // Ligne 9, quatrième octet (opacité) : 255.
  assert.equal(real[row(9) + 3], 255);
// Fin du test.
});

// Test : l'état de l'animation en boucle.
test('animation : la copie qui boucle a un poids nul, les deux couvrent ±3 h de vent', () => {
  // État à l'instant 0.
  const a = flowState(0);
  // Secondes de vent de la copie 0 : moins la moitié de la durée simulée.
  assert.equal(a.s0, -FLOW_SPAN_S / 2);
  // Poids de la copie 1 : 1.
  assert.equal(a.weight1, 1);           // copie 0 au départ : invisible
  // État à la moitié de la boucle.
  const b = flowState(FLOW_PERIOD_S / 2);
  // Secondes de vent de la copie 0 : nulles, à 1e-9 près.
  assert.ok(Math.abs(b.s0) < 1e-9);
  // Poids de la copie 1 : 0.
  assert.equal(b.weight1, 0);           // copie 1 au départ : invisible
  // Secondes de vent de la copie 1 : moins la moitié de la durée simulée, à 1e-9 près.
  assert.ok(Math.abs(b.s1 + FLOW_SPAN_S / 2) < 1e-9);
  // État après 7,25 boucles.
  const c = flowState(FLOW_PERIOD_S * 7.25);
  // Secondes de vent de la copie 0 : moins un quart de la durée simulée, à 1e-6 près.
  assert.ok(Math.abs(c.s0 + FLOW_SPAN_S / 4) < 1e-6);
  // De 0 à 100 secondes par pas de 0,37 : le poids reste entre 0 et 1 et les secondes de vent de la copie 0 ne dépassent pas la moitié de la durée simulée.
  for (let t = 0; t < 100; t += 0.37) { const s = flowState(t); assert.ok(s.weight1 >= 0 && s.weight1 <= 1 && Math.abs(s.s0) <= FLOW_SPAN_S / 2); }
// Fin du test.
});
