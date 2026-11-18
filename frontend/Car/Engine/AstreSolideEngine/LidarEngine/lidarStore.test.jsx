// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la base testée.
import { LidarStore } from './lidarStore.jsx';

// Base de 100 octets : écritures, lectures, sortie des plus anciennes quand elle est pleine.
test('LidarStore : écrit en même temps, relit, fait sortir les plus anciens quand elle est pleine', () => {
  // Une base de 100 octets.
  const db = new LidarStore(100);
  // Trois fichiers de 40 octets : le troisième fait sortir le premier.
  db.put('a', new ArrayBuffer(40)); db.put('b', new ArrayBuffer(40)); db.put('c', new ArrayBuffer(40));
  // « a » est sorti, « b » et « c » restent.
  assert.equal(db.get('a'), null);
  // « b » est relu.
  assert.equal(db.get('b').byteLength, 40);
  // État : 80 octets, 2 fichiers, 40 sortis, 1 lecture servie, 3 écritures.
  assert.deepEqual(db.snapshot(), { used: 80, capacity: 100, files: 2, evicted: 40, hits: 1, writes: 3 });
  // Déjà présent, vide ou trop grand : refusé.
  assert.equal(db.put('b', new ArrayBuffer(10)), false);
  // Vide.
  assert.equal(db.put('d', new ArrayBuffer(0)), false);
  // Trop grand.
  assert.equal(db.put('e', new ArrayBuffer(101)), false);
  // Vidée : plus rien.
  db.clear(); assert.equal(db.snapshot().used, 0);
});
