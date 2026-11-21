import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES, engineFor, locate, modelItinerary, modelSegment } from './modes.js';
import { haversineKm } from './geo.js';

const A = { lat: 48.9992, lon: 2.0967 }, G = { lat: 48.9961, lon: 2.0924 }, CDG = { lat: 49.0097, lon: 2.5479 }, JFK = { lat: 40.6413, lon: -73.7781 };
const itinerary = {
  segments: [
    { index: 0, mode: 'marche', category: 'sol', label: 'Gare', from: A, to: G, waypoints: [{ lat: 48.998, lon: 2.095 }], minutes: 8, km: 0.5 },
    { index: 1, mode: 'train', category: 'sol', label: 'Aéroport', from: G, to: CDG, waypoints: [{ lat: 49.0, lon: 2.3 }], minutes: 40, km: 30 },
    { index: 2, mode: 'avion', category: 'vol', label: 'Vol', from: CDG, to: JFK, waypoints: [], minutes: 480, km: 5800, altitudeKm: 11 },
  ],
};

test('chaque moyen a son moteur : vol en 3D, sol en 2D', () => {
  for (const id of ['avion', 'helicoptere', 'fusee', 'drone', 'ballon', 'planeur', 'autre-vol']) assert.equal(ENGINES[id].dimension, '3d', id);
  for (const id of ['marche', 'course', 'velo', 'trottinette', 'moto', 'voiture', 'bus', 'tramway', 'metro', 'train', 'bateau', 'ski', 'cheval', 'autre-sol']) assert.equal(ENGINES[id].dimension, '2d', id);
  assert.equal(Object.keys(ENGINES).length, 21);
  for (const [id, e] of Object.entries(ENGINES)) assert.equal(e.id, id);
});

test('un moyen inconnu prend le moteur générique de sa catégorie', () => {
  assert.equal(engineFor('tuk-tuk', 'sol').id, 'autre-sol');
  assert.equal(engineFor('jetpack', 'vol').id, 'autre-vol');
  assert.equal(engineFor(undefined).id, 'autre-sol');
});

test('2D : tracé au sol, altitude nulle, extrémités respectées', () => {
  const t = modelSegment(itinerary.segments[1]);
  assert.equal(t.dimension, '2d');
  assert.ok(t.points.length >= 24);
  assert.ok(t.points.every((p) => p.alt === 0));
  assert.ok(haversineKm(t.points[0], G) < 1e-6 && haversineKm(t.points.at(-1), CDG) < 1e-6);
  assert.deepEqual(t.stops, [{ lat: 49.0, lon: 2.3 }], 'le train marque ses gares');
  assert.deepEqual(modelSegment(itinerary.segments[0]).stops, [], 'la marche n’a pas d’arrêts');
});

test('3D : profil d’altitude montée / croisière / descente', () => {
  const t = modelSegment(itinerary.segments[2]);
  assert.equal(t.dimension, '3d');
  assert.equal(t.points[0].alt, 0);
  assert.ok(Math.abs(t.points.at(-1).alt) < 1e-9);
  const max = Math.max(...t.points.map((p) => p.alt));
  assert.ok(Math.abs(max - 11) < 1e-9, 'altitude du modèle respectée');
  assert.ok(t.points[Math.floor(t.points.length / 2)].alt > 10.9);
});

test('altitude par défaut du moteur quand le modèle n’en donne pas, et profils propres à chaque véhicule', () => {
  const base = { index: 0, from: CDG, to: JFK, waypoints: [], minutes: 100, km: 5800 };
  const h = modelSegment({ ...base, mode: 'helicoptere', category: 'vol' });
  assert.ok(Math.max(...h.points.map((p) => p.alt)) <= 0.6 + 1e-9);
  const f = modelSegment({ ...base, mode: 'fusee', category: 'vol' });
  assert.ok(Math.max(...f.points.map((p) => p.alt)) > 150, 'apogée de fusée');
  const g = modelSegment({ ...base, mode: 'planeur', category: 'vol' });
  assert.ok(g.points[2].alt > g.points.at(-3).alt, 'le planeur perd de l’altitude');
});

test('itinéraire complet : trois étapes, totaux, étapes invalides ignorées', () => {
  const m = modelItinerary({ segments: [...itinerary.segments, { mode: 'voiture', from: { lat: 'x' }, to: JFK, minutes: 5 }, null] });
  assert.equal(m.tracks.length, 3);
  assert.equal(m.totalMinutes, 528);
  assert.deepEqual(m.tracks.map((t) => t.engineId), ['marche', 'train', 'avion']);
  assert.deepEqual(modelItinerary(null).tracks, []);
});

test('locate : chaque étape garde au moins 8 % de l’animation', () => {
  const { tracks } = modelItinerary(itinerary);
  assert.equal(locate(tracks, 0).index, 0);
  assert.equal(locate(tracks, 1).index, 2);
  assert.equal(locate(tracks, 1).local, 1);
  assert.equal(locate(tracks, 0.05).index, 0, 'la marche de 8 min existe à l’écran malgré un vol de 8 h');
  assert.equal(locate([], 0.5), null);
  const seen = new Set();
  for (let u = 0; u <= 1; u += 0.01) seen.add(locate(tracks, u).index);
  assert.equal(seen.size, 3);
});
