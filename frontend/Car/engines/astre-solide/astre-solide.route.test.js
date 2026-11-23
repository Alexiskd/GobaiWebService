// Tests du vol entre deux lieux (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { bearing, cruiseAltitudeM, easeRoute, findCity, greatCircle, parseRoute, routeAltitudeM, routeDurationMs, routeKm } from './astre-solide.route.js';

const cities = [
  { name: 'Tokyo', country: 'Japan', lon: 139.75, lat: 35.69 },
  { name: 'Paris', country: 'France', lon: 2.35, lat: 48.86 },
  { name: 'Cairo', nameFr: 'Le Caire', country: 'Egypt', lon: 31.25, lat: 30.05 },
  { name: 'Paris', country: 'United States', lon: -95.55, lat: 33.66 },
  { name: 'São Paulo', country: 'Brazil', lon: -46.63, lat: -23.55 },
];

test('trajet écrit de plusieurs façons', () => {
  assert.deepEqual(parseRoute('Paris → Tokyo'), ['Paris', 'Tokyo']);
  assert.deepEqual(parseRoute('de Paris à Le Caire'), ['Paris', 'Le Caire']);
  assert.deepEqual(parseRoute('paris-tokyo'), null);
  assert.deepEqual(parseRoute('Paris - Tokyo'), ['Paris', 'Tokyo']);
  assert.deepEqual(parseRoute('Paris > Tokyo'), ['Paris', 'Tokyo']);
  assert.equal(parseRoute('Paris'), null);
});

test('ville : nom français, accents, la plus peuplée d\'abord, début du nom', () => {
  assert.equal(findCity(cities, 'paris').country, 'France');
  assert.equal(findCity(cities, 'le caire').name, 'Cairo');
  assert.equal(findCity(cities, 'sao paulo').name, 'São Paulo');
  assert.equal(findCity(cities, 'Tok').name, 'Tokyo');
  assert.equal(findCity(cities, 'Atlantide'), null);
});

test('grand cercle, distance, cap', () => {
  const p = cities[1], t = cities[0];
  assert.ok(Math.abs(routeKm(p, t) - 9712) < 30);
  const s = greatCircle(p, t, 0), e = greatCircle(p, t, 1);
  assert.ok(Math.abs(s.lon - p.lon) < 1e-9 && Math.abs(e.lat - t.lat) < 1e-9);
  // Le grand cercle Paris–Tokyo passe bien au nord des deux villes.
  assert.ok(greatCircle(p, t, 0.5).lat > 60);
  assert.ok(Math.abs(bearing({ lon: 0, lat: 0 }, { lon: 0, lat: 10 })) < 1e-9);
  assert.ok(Math.abs(bearing({ lon: 0, lat: 0 }, { lon: 10, lat: 0 }) - 90) < 1e-9);
});

test('durée, altitude de croisière, profil d\'altitude, adoucissement', () => {
  assert.equal(routeDurationMs(0), 3000); assert.equal(routeDurationMs(40000), 12000);
  assert.equal(cruiseAltitudeM(10), 3e4); assert.equal(cruiseAltitudeM(1e5), 4e6);
  assert.equal(routeAltitudeM(0, 5000, 8000, 1e6), 5000);
  assert.ok(Math.abs(routeAltitudeM(1, 5000, 8000, 1e6) - 8000) < 1e-6);
  assert.ok(routeAltitudeM(0.5, 5000, 5000, 1e6) > 9e5);
  assert.equal(easeRoute(-1), 0); assert.equal(easeRoute(0.5), 0.5); assert.equal(easeRoute(2), 1);
});
