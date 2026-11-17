// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le niveau le plus large et la fonction testée.
import { OUTER_LEVEL, scaleLevel } from './scaleLevels';

// Test : les niveaux de la Terre.
test('Terre : de la rue au système solaire, sans trou', () => {
  // Option : l'astre est la Terre.
  const earth = { earth: true };
  // À 100 m : la rue.
  assert.equal(scaleLevel(0.1, earth), 'Rue');
  // À 1 km : le quartier.
  assert.equal(scaleLevel(1, earth), 'Quartier');
  // À 10 km : la ville.
  assert.equal(scaleLevel(10, earth), 'Ville');
  // À 100 km : la région.
  assert.equal(scaleLevel(100, earth), 'Région');
  // À 1 000 km : le pays.
  assert.equal(scaleLevel(1000, earth), 'Pays');
  // À 5 000 km : le continent.
  assert.equal(scaleLevel(5000, earth), 'Continent');
  // À 50 000 km : la planète.
  assert.equal(scaleLevel(50_000, earth), 'Planète');
  // À 400 000 km : la planète et ses satellites.
  assert.equal(scaleLevel(400_000, earth), 'Planète et satellites'); // la Lune entre dans le champ
  // À 100 millions de km : le système solaire interne.
  assert.equal(scaleLevel(1e8, earth), 'Système solaire interne');
  // À 5 milliards de km : le niveau le plus large.
  assert.equal(scaleLevel(5e9, earth), OUTER_LEVEL);
  // Jamais de niveau vide, et jamais de retour en arrière en s'éloignant.
  // Niveaux déjà rencontrés.
  const seen = [];
  // En s'éloignant par pas de 50 %.
  for (let km = 0.01; km < 1e11; km *= 1.5) {
    // Le niveau à cette altitude.
    const level = scaleLevel(km, earth);
    // Il n'est jamais vide.
    assert.ok(level);
    // Nouveau niveau : il ne doit pas avoir déjà été vu.
    if (seen[seen.length - 1] !== level) { assert.ok(!seen.includes(level)); seen.push(level); }
  // Fin du parcours.
  }
  // Dix niveaux en tout.
  assert.equal(seen.length, 10);
// Fin du test.
});

// Test : les autres astres.
test('autres astres : sol et relief, pas de rues', () => {
  // À 1 km : le sol.
  assert.equal(scaleLevel(1), 'Sol');
  // À 100 km : le relief.
  assert.equal(scaleLevel(100), 'Relief');
  // À 1 000 km : la région.
  assert.equal(scaleLevel(1000), 'Région');
  // À 50 000 km : la planète.
  assert.equal(scaleLevel(50_000), 'Planète');
// Fin du test.
});

// Test : le Soleil et les valeurs illisibles.
test('Soleil et valeurs illisibles', () => {
  // À un million de km du Soleil : « Soleil ».
  assert.equal(scaleLevel(1e6, { star: true }), 'Soleil');
  // À 100 millions de km : le système solaire interne.
  assert.equal(scaleLevel(1e8, { star: true }), 'Système solaire interne');
  // À 10 milliards de km : le niveau le plus large.
  assert.equal(scaleLevel(1e10, { star: true }), OUTER_LEVEL);
  // Valeur illisible : chaîne vide.
  assert.equal(scaleLevel(NaN), '');
// Fin du test.
});
