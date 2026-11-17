// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les fonctions testées.
import {
  MAX_VOLCANOES, VOLCANO_V_MAX, VOLCANO_V_MIN, buildVolcanoAttributes, grainFlightS, lonLatToUnit, normalizeVolcanoes, plumeHeightKm,
} from './volcanoesMath';

// near : deux nombres égaux à une tolérance près.
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Test : le repère du globe.
test('volcans : un point du globe est placé comme les autres repères de la Terre', () => {
  // Longitude 0, latitude 0 : sur l'axe x.
  assert.deepEqual(lonLatToUnit(0, 0).map((n) => Math.round(n * 1e6) / 1e6 + 0), [1, 0, 0]);
  // Pôle nord : sur l'axe y.
  assert.ok(near(lonLatToUnit(0, 90)[1], 1));
  // Longitude 90° est : du côté des z négatifs.
  assert.ok(near(lonLatToUnit(90, 0)[2], -1));
// Fin du test.
});

// Test : le nettoyage de la liste.
test('volcans : la liste garde les coordonnées valides, sans doublon, avec un maximum', () => {
  // Liste d'essai.
  const list = normalizeVolcanoes([
    // Valide.
    { id: 'a', name: 'Stromboli Volcano, Italy', lon: 15.213, lat: 38.789 },
    // Doublon.
    { id: 'a', name: 'Stromboli', lon: 15.213, lat: 38.789 },
    // Latitude impossible.
    { id: 'b', name: 'X', lon: 0, lat: 95 },
    // Coordonnées absentes.
    { id: 'c', name: 'Y' },
  // Fin de la liste.
  ]);
  // Un seul volcan gardé.
  assert.deepEqual(list, [{ id: 'a', name: 'Stromboli Volcano, Italy', lon: 15.213, lat: 38.789 }]);
  // Ce qui n'est pas une liste : aucun volcan.
  assert.deepEqual(normalizeVolcanoes(null), []);
  // Deux cents volcans : seulement le maximum.
  assert.equal(normalizeVolcanoes(Array.from({ length: 200 }, (_, i) => ({ id: i, lon: i - 100, lat: 0 }))).length, MAX_VOLCANOES);
// Fin du test.
});

// Test : l'échelle du panache.
test('volcans : le panache monte de 6 à 18 km et un grain vole de 4 à 7 secondes', () => {
  // Hauteur la plus faible : environ 5,7 km.
  assert.ok(plumeHeightKm(VOLCANO_V_MIN) > 5 && plumeHeightKm(VOLCANO_V_MIN) < 7);
  // Hauteur la plus forte : environ 18 km.
  assert.ok(plumeHeightKm(VOLCANO_V_MAX) > 17 && plumeHeightKm(VOLCANO_V_MAX) < 19);
  // Vol le plus court : 4 secondes.
  assert.ok(near(grainFlightS(VOLCANO_V_MIN), 4, 1e-3));
  // Vol le plus long : sous 7,2 secondes.
  assert.ok(grainFlightS(VOLCANO_V_MAX) < 7.2);
// Fin du test.
});

// Test : les tableaux des points.
test('volcans : chaque volcan a un repère puis des grains qui partent du cratère, tangents au sol', () => {
  // Deux volcans, dont un au pôle nord.
  const volcanoes = [{ id: 'a', lon: 15.213, lat: 38.789 }, { id: 'p', lon: 0, lat: 90 }];
  // Les tableaux, avec 20 grains par volcan.
  const a = buildVolcanoAttributes(volcanoes, 20);
  // Nombre de points : 21 par volcan.
  assert.equal(a.count, 42);
  // Pour chaque point (début).
  for (let i = 0; i < a.count; i++) {
    // Son cratère.
    const p = [a.position[i * 3], a.position[i * 3 + 1], a.position[i * 3 + 2]];
    // Sa direction de dérive.
    const s = [a.slide[i * 3], a.slide[i * 3 + 1], a.slide[i * 3 + 2]];
    // Cratère sur la sphère de rayon 1.
    assert.ok(near(Math.hypot(...p), 1, 1e-5));
    // Aucun nombre invalide, même au pôle.
    assert.ok([...p, ...s].every(Number.isFinite));
    // Premier point de chaque volcan : le repère, sans vitesse.
    if (i % 21 === 0) { assert.equal(a.launch[i * 4], 0); continue; }
    // Grain : direction unitaire.
    assert.ok(near(Math.hypot(...s), 1, 1e-4));
    // Tangente au sol.
    assert.ok(Math.abs(p[0] * s[0] + p[1] * s[1] + p[2] * s[2]) < 1e-4);
    // Vitesse verticale bornée.
    assert.ok(a.launch[i * 4] >= VOLCANO_V_MIN * 0.999 && a.launch[i * 4] <= VOLCANO_V_MAX * 1.001);
  // Fin de la boucle.
  }
// Fin du test.
});
