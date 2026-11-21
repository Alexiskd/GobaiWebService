// Tests des fonctions pures de la fenêtre « Trajet » : positions, signature, durée, distance, coordonnées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { earthPoint, formatCoords, formatDuration, formatKm, isPoint, moonPoint, pointLabel, tripSignature } from './trajet.js';

test('une position de la Terre garde son nom ; une valeur hors bornes est refusée', () => {
  assert.deepEqual(earthPoint({ name: ' Paris ', lat: 48.85, lon: 2.35, context: 'France' }), { body: 'earth', lat: 48.85, lon: 2.35, name: 'Paris' });
  assert.deepEqual(earthPoint({ lat: 1, lon: 2 }), { body: 'earth', lat: 1, lon: 2 });
  assert.equal(earthPoint({ lat: 91, lon: 0 }), null);
  assert.equal(earthPoint({ lat: 0, lon: 181 }), null);
  assert.equal(earthPoint({ lat: null, lon: 0 }), null);
  assert.equal(earthPoint(null), null);
});

test('un site lunaire devient une position de la Lune', () => {
  assert.deepEqual(moonPoint({ name: 'Apollo 11', lat: 0.674, lon: 23.473, info: 'x' }), { body: 'moon', lat: 0.674, lon: 23.473, name: 'Apollo 11' });
  assert.equal(moonPoint({ lat: 'a', lon: 0 }), null);
});

test('la signature change avec A, B ou le fournisseur, et reste vide tant qu’il manque un point', () => {
  const a = { body: 'earth', lat: 1, lon: 2 }, b = { body: 'moon', lat: 3, lon: 4 };
  assert.equal(tripSignature(a, null), '');
  assert.equal(tripSignature(null, b), '');
  assert.equal(tripSignature(a, b, 'claude'), tripSignature({ ...a }, { ...b }, 'claude'));
  assert.notEqual(tripSignature(a, b, 'claude'), tripSignature(b, a, 'claude'));
  assert.notEqual(tripSignature(a, b, 'claude'), tripSignature(a, b, 'mistral'));
  assert.ok(isPoint(a) && !isPoint({ body: 'mars', lat: 0, lon: 0 }));
});

test('la durée s’écrit en jours, heures et minutes', () => {
  assert.equal(formatDuration(4320), '3 j');
  assert.equal(formatDuration(1740), '1 j 5 h');
  assert.equal(formatDuration(80), '1 h 20 min');
  assert.equal(formatDuration(120), '2 h');
  assert.equal(formatDuration(35), '35 min');
  assert.equal(formatDuration(0), '—');
  assert.equal(formatDuration('x'), '—');
});

test('la distance est arrondie, avec une décimale sous 10 km', () => {
  assert.match(formatKm(384400), /^384\s400 km$/u);
  assert.equal(formatKm(21.4), '21 km');
  assert.equal(formatKm(4.26), '4,3 km');
  assert.equal(formatKm(-1), '—');
});

test('les coordonnées portent les points cardinaux, et le nom prime sur elles', () => {
  assert.equal(formatCoords({ body: 'earth', lat: 48.9992, lon: 2.0967 }), '48,9992° N, 2,0967° E');
  assert.equal(formatCoords({ body: 'moon', lat: -3.012, lon: -23.422 }), '3,012° S, 23,422° O');
  assert.equal(formatCoords(null), '');
  assert.equal(pointLabel({ body: 'earth', lat: 1, lon: 2, name: 'Paris' }), 'Paris');
  assert.equal(pointLabel({ body: 'earth', lat: 1, lon: 2 }), '1° N, 2° E');
});
