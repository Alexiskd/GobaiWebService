// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { bytes, seconds } from './perfFormat.jsx';

// Test : les durées du moniteur, en secondes avec une décimale.
test('durées en secondes, « … » tant que rien n’est mesuré', () => {
  // 2 412 ms : 2,4 s (virgule décimale française).
  assert.equal(seconds(2412), '2,4 s');
  // 0 ms : 0,0 s.
  assert.equal(seconds(0), '0,0 s');
  // Pas encore mesuré : points de suspension.
  assert.equal(seconds(null), '…');
// Fin du test.
});

// Test : les octets reçus, en ko puis en Mo.
test('octets en ko, puis en Mo au-delà d’un mégaoctet', () => {
  // 54 321 octets : 53 ko.
  assert.equal(bytes(54321), '53 ko');
  // 3 355 443 octets : 3,2 Mo.
  assert.equal(bytes(3355443), '3,2 Mo');
  // Valeur absente : 0 ko.
  assert.equal(bytes(undefined), '0 ko');
// Fin du test.
});
