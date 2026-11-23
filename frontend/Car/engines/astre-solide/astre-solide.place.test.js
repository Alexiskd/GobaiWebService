// Tests du nom du lieu sous la caméra du globe (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_ABOVE_KM, FAR_KM, REGION_ABOVE_KM, cityIndex, distanceKm, nearestCity, placeText } from './astre-solide.place.js';

const cities = [
  { name: 'Paris', country: 'France', region: 'Île-de-France', lon: 2.35, lat: 48.86 },
  { name: 'Rouen', country: 'France', region: 'Normandie', lon: 1.1, lat: 49.44 },
  { name: 'Cairo', nameFr: 'Le Caire', country: 'Egypt', countryFr: 'Égypte', region: 'Al Qahirah', lon: 31.25, lat: 30.05 },
  { name: 'Singapore', country: 'Singapore', region: 'Singapore', lon: 103.85, lat: 1.29 },
];

test('distance sur la sphère', () => {
  assert.ok(Math.abs(distanceKm(0, 0, 0, 1) - 111.19) < 0.1);
  assert.equal(distanceKm(2, 48, 2, 48), 0);
});

test('ville la plus proche', () => {
  assert.equal(nearestCity(cities, 2.1, 49).city.name, 'Paris');
  assert.equal(nearestCity([], 0, 0), null);
  assert.equal(nearestCity([{ name: 'x' }], 0, 0), null);
});

test('précision selon l\'altitude, noms français, sans doublon ni lieu lointain', () => {
  assert.equal(placeText(cities, 2.35, 48.86, COUNTRY_ABOVE_KM + 1), 'France');
  assert.equal(placeText(cities, 2.35, 48.86, REGION_ABOVE_KM + 1), 'Île-de-France · France');
  assert.equal(placeText(cities, 2.3, 48.9, 2), 'Paris · Île-de-France · France');
  // Ville trop loin pour l'altitude : région et pays seulement.
  assert.equal(placeText(cities, 2.35, 49.3, 2), 'Île-de-France · France');
  assert.equal(placeText(cities, 31.25, 30.05, 5), 'Le Caire · Al Qahirah · Égypte');
  assert.equal(placeText(cities, 103.85, 1.29, 5), 'Singapore');
  // En plein océan : rien.
  assert.ok(distanceKm(-40, 30, 2.35, 48.86) > FAR_KM);
  assert.equal(placeText(cities, -40, 30, 5), '');
  assert.equal(placeText(null, 0, 0, 5), '');
});

test('index des villes : calculé une fois par liste, même résultat que la distance', () => {
  assert.equal(cityIndex(cities), cityIndex(cities));
  for (const [lon, lat] of [[2.1, 49], [30, 31], [100, 0], [1.2, 49.5]]) {
    const byDist = [...cities].sort((a, b) => distanceKm(lon, lat, a.lon, a.lat) - distanceKm(lon, lat, b.lon, b.lat))[0];
    assert.equal(nearestCity(cities, lon, lat).city, byDist);
  }
});
