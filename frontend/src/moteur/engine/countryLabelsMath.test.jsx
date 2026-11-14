// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe depuis countryLabelsMath (début de la liste).
import {
  // Les cinq fonctions testées : opacité, tri par taille, hauteur du texte, point dans un contour, morceau de pays.
  countryLabelOpacity, countryLabelSizeAlpha, countryLabelHeightDeg, pointInRing, findCountryPart,
  // La hauteur minimale d'une étiquette, en degrés.
  MIN_LABEL_HEIGHT_DEG,
// Fin de la liste : le module countryLabelsMath.
} from './countryLabelsMath';

// Test : l'opacité des noms de pays selon l'altitude passée (8, 6, 5, 4, 1, 0,3 puis 0).
test('noms de pays : visibles du globe lisible jusqu’au niveau des villes', () => {
  // À 8 : 0, trop loin.
  assert.equal(countryLabelOpacity(8), 0, 'trop loin');
  // À 6 : 0, début du fondu.
  assert.equal(countryLabelOpacity(6), 0, 'début du fondu');
  // À 5 : 0,8.
  assert.equal(countryLabelOpacity(5), 0.8);
  // À 4 : 1, globe lisible.
  assert.equal(countryLabelOpacity(4), 1, 'globe lisible');
  // À 1 : 1, les noms restent affichés.
  assert.equal(countryLabelOpacity(1), 1, 'les noms posés au sol restent en zoomant');
  // À 0,3 : 0, les villes prennent le relais.
  assert.equal(countryLabelOpacity(0.3), 0, 'les villes prennent le relais');
  // À 0 : 0.
  assert.equal(countryLabelOpacity(0), 0);
// Fin du test.
});

// Test : le tri des noms par taille à l'écran.
test('noms de pays : tri par taille à l’écran', () => {
  // Taille 4 : 0, illisible.
  assert.equal(countryLabelSizeAlpha(4), 0, 'illisible');
  // Taille 12 : 1.
  assert.equal(countryLabelSizeAlpha(12), 1);
  // Taille 60 : 1.
  assert.equal(countryLabelSizeAlpha(60), 1);
  // Taille 120 : 0, envahissant.
  assert.equal(countryLabelSizeAlpha(120), 0, 'envahissant');
// Fin du test.
});

// Test : la hauteur du texte d'un nom de pays.
test('noms de pays : le texte tient entre les frontières', () => {
  // Grand pays : plafonné par l'importance.
  // Rayon 12, rapport largeur/hauteur 4 et rang 2 : la hauteur vaut 2,4.
  assert.equal(countryLabelHeightDeg(12, 4, 2), 2.4);
  // Pays moyen : largeur = 1,9 × r au plus.
  // Hauteur pour un rayon de 3, un rapport de 5 et un rang de 2.
  const h = countryLabelHeightDeg(3, 5, 2);
  // Vérifie que cette hauteur multipliée par 5 vaut 1,9 × 3, à 1e-9 près.
  assert.ok(Math.abs(h * 5 - 1.9 * 3) < 1e-9);
  // Pays allongé (nom court) : hauteur ≤ 0,6 × r.
  // Rayon 1, rapport 1,2 et rang 3 : la hauteur ne dépasse pas 0,6.
  assert.ok(countryLabelHeightDeg(1, 1.2, 3) <= 0.6 + 1e-9);
  // Minuscule : plancher de lisibilité.
  // Rayon 0,05, rapport 6 et rang 5 : la hauteur vaut le minimum de lisibilité.
  assert.equal(countryLabelHeightDeg(0.05, 6, 5), MIN_LABEL_HEIGHT_DEG);
// Fin du test.
});

// Test : la recherche du morceau de pays qui contient un point.
test('noms de pays : morceau qui contient le point d’ancrage, enclave comprise', () => {
  // square : contour fermé d'un rectangle, en liste plate de coordonnées (cinq points, le premier répété).
  const square = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  // Le point (1, 1) est dans le carré de 0 à 2.
  assert.ok(pointInRing(1, 1, square(0, 0, 2, 2)));
  // Le point (3, 1) n'y est pas.
  assert.ok(!pointInRing(3, 1, square(0, 0, 2, 2)));
  // Pays d'essai (début du tableau).
  const countries = [
    // « Grand » : deux morceaux, un carré de 0 à 10 (surface 100) et un petit carré de 20 à 22 (surface 4).
    { name: 'Grand', parts: [{ lon: 5, lat: 5, r: 4, area: 100, ring: square(0, 0, 10, 10) }, { lon: 21, lat: 1, r: 1, area: 4, ring: square(20, 0, 22, 2) }] },
    // « Enclave » : un seul morceau, un carré de 4,5 à 5,5 situé à l'intérieur du premier.
    { name: 'Enclave', parts: [{ lon: 5, lat: 5, r: 0.5, area: 1, ring: square(4.5, 4.5, 5.5, 5.5) }] },
  // Fin du tableau.
  ];
  // Le point (2, 2) : le morceau de surface 100.
  assert.equal(findCountryPart(2, 2, countries).area, 100, 'continent');
  // Le point (21,5, 1,5) : le morceau de surface 4.
  assert.equal(findCountryPart(21.5, 1.5, countries).area, 4, 'île');
  // Le point (5, 5) : le morceau de rayon 0,5, celui de l'enclave.
  assert.equal(findCountryPart(5, 5, countries).r, 0.5, 'enclave');
  // Le point (50, 50) : aucun morceau, null.
  assert.equal(findCountryPart(50, 50, countries), null, 'hors de tout pays');
// Fin du test.
});
