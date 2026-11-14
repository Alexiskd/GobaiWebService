// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ouvre l'import de ce qui est testé :
import {
  // les constantes et les fonctions du module.
  PENSEES_PAR_JOUR, POPULATION_ONU, decimalYear, fluxCognitif, fluxCognitifEnDirect, fluxCurve, populationGrowthPerSecond, worldPopulation,
// Fin de l'import.
} from './fluxCognitif';

// Premier test : la population.
test('population mondiale : valeurs ONU aux dates de la table, interpolation entre deux', () => {
  // Au 1er juillet 2026 : la valeur de la table.
  assert.equal(worldPopulation(Date.UTC(2026, 6, 1)), 8_300_678_395);
  // Au 1er juillet 2046 : la valeur de la table.
  assert.equal(worldPopulation(Date.UTC(2046, 6, 1)), 9_487_889_604);
  // Population au 11 novembre 2026.
  const nov = worldPopulation(Date.UTC(2026, 10, 11));
  // Elle est entre celles de 2026 et de 2027.
  assert.ok(nov > 8_300_678_395 && nov < 8_369_094_344);
  // Elle suit l'interpolation, à une personne près.
  assert.ok(Math.abs(nov - (8_300_678_395 + (68_415_949 * 133) / 365)) < 1);
  // Hors table : la pente de l'intervalle voisin est prolongée.
  // Avant la table : moins que la première valeur.
  assert.ok(worldPopulation(Date.UTC(2023, 6, 1)) < 8_161_972_572);
  // Après la table : plus que la dernière.
  assert.ok(worldPopulation(Date.UTC(2047, 6, 1)) > 9_487_889_604);
  // Croissance au 11 novembre 2026.
  const growth = populationGrowthPerSecond(Date.UTC(2026, 10, 11));
  // Environ 2,2 personnes par seconde.
  assert.ok(growth > 2.1 && growth < 2.3, `≈ 2,2 personnes par seconde, reçu ${growth}`);
// Fin du test.
});

// Deuxième test : la relation.
test('relation F = P × p : par seconde, par jour, par an', () => {
  // Flux pour 8,15 milliards de personnes.
  const f = fluxCognitif(8.15e9);
  // Par jour : la population fois 6 200.
  assert.equal(f.parJour, 8.15e9 * PENSEES_PAR_JOUR);
  // Environ 5,05 × 10¹³ par jour.
  assert.ok(Math.abs(f.parJour - 5.053e13) < 1e10);
  // Environ 5,85 × 10⁸ par seconde.
  assert.ok(Math.abs(f.parSeconde - 5.848e8) < 1e5);
  // Environ 1,85 × 10¹⁶ par an.
  assert.ok(Math.abs(f.parAn - 1.8456e16) < 1e12);
  // Avec 60 000 pensées par jour : le produit attendu.
  assert.equal(fluxCognitif(1e9, 60000).parJour, 6e13);
  // Flux en direct au 1er juillet 2026.
  const live = fluxCognitifEnDirect(Date.UTC(2026, 6, 1));
  // Sa population est celle de la table.
  assert.equal(live.population, 8_300_678_395);
  // Son flux par jour est le produit attendu.
  assert.equal(live.parJour, 8_300_678_395 * 6200);
// Fin du test.
});

// Troisième test : la courbe.
test('courbe : un point par année de la table, croissante', () => {
  // Courbe par défaut.
  const curve = fluxCurve();
  // Un point par année de la table.
  assert.equal(curve.length, POPULATION_ONU.length);
  // Le premier point est celui de 2024.
  assert.deepEqual(curve[0], [2024, 8_161_972_572 * 6200]);
  // La courbe monte d'un point au suivant.
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i][1] > curve[i - 1][1]);
  // Le 2 juillet 2026 à midi est l'année 2026,5.
  assert.ok(Math.abs(decimalYear(Date.UTC(2026, 6, 2, 12)) - 2026.5) < 0.002);
// Fin du test.
});
