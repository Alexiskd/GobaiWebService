import test from 'node:test';
import assert from 'node:assert/strict';
import { cityStatsFrom, countryKey } from './worldCityStats';

const france = {
  year: 2025,
  source: 'Worldometer (worldometers.info)',
  sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  cities: {
    Paris: { pop: 9381921, areaKm2: 1381, density: 6794 },
    Lyon: { pop: 1202985 },
    Vide: { pop: 0, areaKm2: 10 },
  },
};

test('clé de pays : accents, esperluette et ponctuation neutralisés', () => {
  assert.equal(countryKey('France'), 'france');
  assert.equal(countryKey('Côte d’Ivoire'), 'cote d ivoire');
  assert.equal(countryKey('Bosnia & Herzegovina'), 'bosnia and herzegovina');
  assert.equal(countryKey('Washington,  D.C.'), 'washington d c');
  assert.equal(countryKey(null), '');
});

test('statistiques : population, aire et densité reprises telles quelles', () => {
  assert.deepEqual(cityStatsFrom(france, 'Paris'), {
    pop: 9381921,
    areaKm2: 1381,
    density: 6794,
    year: 2025,
    source: 'Worldometer (worldometers.info)',
    sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  });
});

test('statistiques : champs absents omis, ville inconnue ou vide ignorée', () => {
  assert.deepEqual(cityStatsFrom(france, 'Lyon'), {
    pop: 1202985,
    year: 2025,
    source: 'Worldometer (worldometers.info)',
    sourceUrl: 'https://www.worldometers.info/population/largest-cities-in-france/',
  });
  assert.equal(cityStatsFrom(france, 'Marseille'), null);
  assert.equal(cityStatsFrom(france, 'Vide'), null);
  assert.equal(cityStatsFrom(null, 'Paris'), null);
});
