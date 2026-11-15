// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { DEFAULT_LOG_CHL, decodeChlorophyll, fillGaps, logChlAt, oceanPixels, seaShade, waterColour } from './oceanColour.jsx';
// Importe la table des couleurs.
import { OCEAN_COLOURS } from './oceanColourLut.js';

// Test : décodage de l'image grise.
test('décode le gris en logarithme de chlorophylle, NaN sans donnée', () => {
  // Trois pixels : gris 0, gris 255, transparent.
  const g = decodeChlorophyll(new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255, 90, 90, 90, 0]), 0.01, 30);
  // 0,01 et 30 mg/m³ ; puis NaN.
  assert.ok(Math.abs(g[0] + 2) < 1e-6); assert.ok(Math.abs(g[1] - Math.log10(30)) < 1e-6); assert.ok(Number.isNaN(g[2]));
// Fin du test.
});

// Test : comblement des trous.
test('comble les trous par les voisines, puis la valeur par défaut', () => {
  // Grille 3 × 1 : un trou entre −1 et 0.
  assert.deepEqual([...fillGaps(new Float32Array([-1, NaN, 0]), 3, 1)], [-1, -0.5, 0]);
  // Grille entièrement vide : valeur par défaut.
  assert.ok(fillGaps(new Float32Array([NaN, NaN]), 2, 1).every((v) => Math.abs(v - DEFAULT_LOG_CHL) < 1e-6));
// Fin du test.
});

// Test : lecture en un point.
test('lit la chlorophylle en un lieu, la longitude faisant le tour du monde', () => {
  // Grille 4 × 2 du monde : ouest à −2, est à 0, une seule valeur par moitié.
  const grid = new Float32Array([-2, -2, 0, 0, -2, -2, 0, 0]);
  // Au milieu de la moitié ouest : −2 ; de la moitié est : 0.
  assert.equal(logChlAt(grid, 4, 2, [-180, -90, 180, 90], -112.5, 45), -2); assert.equal(logChlAt(grid, 4, 2, [-180, -90, 180, 90], 67.5, -45), 0);
  // Près de 180° : mélange des deux bords (la longitude fait le tour).
  assert.equal(logChlAt(grid, 4, 2, [-180, -90, 180, 90], 180, 45), -1);
// Fin du test.
});

// Test : couleurs.
test('eau du large : bleue sans plancton, plus verte avec', () => {
  // Bornes de la table.
  assert.deepEqual(waterColour(-5), OCEAN_COLOURS[0]); assert.deepEqual(waterColour(5), OCEAN_COLOURS[OCEAN_COLOURS.length - 1]);
  // Eau pauvre : le bleu domine ; eau riche : le vert dépasse le bleu.
  const poor = waterColour(-1.5), rich = waterColour(1);
  // Bleu dominant.
  assert.ok(poor[2] > poor[1] && poor[2] > poor[0]);
  // Vert au-dessus du bleu.
  assert.ok(rich[1] > rich[2]);
// Fin du test.
});

// Test : ombrage.
test('ombre le relief des fonds : neutre à plat, clair face au nord-ouest', () => {
  // Fond plat.
  assert.equal(seaShade(new Float32Array(9).fill(-3000), 3, 1, 1, 100), 1);
  // Pente douce qui monte vers l'est (tournée vers l'ouest, d'où vient la lumière) : plus clair.
  assert.ok(seaShade(new Float32Array([-2, -1, 0, -2, -1, 0, -2, -1, 0]), 3, 1, 1, 100) > 1);
  // Pente inverse (tournée vers l'est) : plus sombre.
  assert.ok(seaShade(new Float32Array([0, -1, -2, 0, -1, -2, 0, -1, -2]), 3, 1, 1, 100) < 1);
// Fin du test.
});

// Test : pixels de l'eau.
test('colore seulement la mer, selon la chlorophylle du lieu', () => {
  // Tuile 0/0/0 de 2 px : moitié ouest de mer, moitié est de terre.
  const px = oceanPixels({ z: 0, x: 0, y: 0, size: 2, height: new Float32Array(4).fill(-4000), mask: new Float32Array([1, 0, 1, 0]), metersAt: () => 1e5,
    // Chlorophylle uniforme : 0,1 mg/m³.
    chl: { grid: new Float32Array([-1]), w: 1, h: 1, bounds: [-180, -90, 180, 90] } });
  // Pixel de mer : la couleur de 0,1 mg/m³, opaque.
  assert.deepEqual([...px.slice(0, 4)], [...waterColour(-1).map(Math.round), 255]);
  // Pixel de terre : vide.
  assert.deepEqual([...px.slice(4, 8)], [0, 0, 0, 0]);
// Fin du test.
});
