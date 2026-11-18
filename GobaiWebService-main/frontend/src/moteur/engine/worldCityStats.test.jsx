// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les deux fonctions testées.
import { cityStatsFrom, countryKey } from './worldCityStats';

// Données d'essai pour la France (début).
const france = {
  // L'année.
  year: 2025,
  // La source.
  source: 'Worldometer (worldometers.info)',
  // L'adresse de la source.
  sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  // Les villes (début).
  cities: {
    // Paris : population, aire et densité.
    Paris: { pop: 9381921, areaKm2: 1381, density: 6794 },
    // Lyon : population seule.
    Lyon: { pop: 1202985 },
    // Une ville sans population.
    Vide: { pop: 0, areaKm2: 10 },
  // Fin des villes.
  },
// Fin des données.
};

// Test : la clé d'un pays.
test('clé de pays : accents, esperluette et ponctuation neutralisés', () => {
  // En minuscules.
  assert.equal(countryKey('France'), 'france');
  // Sans accent ni apostrophe.
  assert.equal(countryKey('Côte d’Ivoire'), 'cote d ivoire');
  // L'esperluette devient « and ».
  assert.equal(countryKey('Bosnia & Herzegovina'), 'bosnia and herzegovina');
  // La ponctuation et les espaces multiples sont réduits.
  assert.equal(countryKey('Washington,  D.C.'), 'washington d c');
  // Valeur nulle : chaîne vide.
  assert.equal(countryKey(null), '');
// Fin du test.
});

// Test : les statistiques complètes.
test('statistiques : population, aire et densité reprises telles quelles', () => {
  // Pour Paris (début) :
  assert.deepEqual(cityStatsFrom(france, 'Paris'), {
    // La population.
    pop: 9381921,
    // L'aire.
    areaKm2: 1381,
    // La densité.
    density: 6794,
    // L'année.
    year: 2025,
    // La source.
    source: 'Worldometer (worldometers.info)',
    // L'adresse de la source.
    sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  // Fin de la vérification.
  });
// Fin du test.
});

// Test : les cas incomplets.
test('statistiques : champs absents omis, ville inconnue ou vide ignorée', () => {
  // Pour Lyon (début) :
  assert.deepEqual(cityStatsFrom(france, 'Lyon'), {
    // La population.
    pop: 1202985,
    // L'année.
    year: 2025,
    // La source.
    source: 'Worldometer (worldometers.info)',
    // L'adresse de la source.
    sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  // Fin de la vérification : pas d'aire ni de densité.
  });
  // Ville inconnue : rien.
  assert.equal(cityStatsFrom(france, 'Marseille'), null);
  // Ville sans population : rien.
  assert.equal(cityStatsFrom(france, 'Vide'), null);
  // Sans données : rien.
  assert.equal(cityStatsFrom(null, 'Paris'), null);
// Fin du test.
});
