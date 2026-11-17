// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la liste des réglages gardés et les deux fonctions testées.
import { LOCK_SAVED_KEYS, nearestIndex, saveCamera } from './viewLock';

// at : fabrique une position (y et z nuls par défaut).
const at = (x, y = 0, z = 0) => ({ x, y, z });

// Test : l'astre le plus proche de l'astre focus.
test('astre le plus proche de l’astre focus : la Lune pour la Terre, la Terre pour la Lune', () => {
  // 0 Soleil, 1 Vénus, 2 Terre, 3 Mars, 4 Lune (unités : rayons terrestres, à la louche)
  // Cinq positions d'essai.
  const bodies = [at(0), at(17000), at(23455), at(35700), at(23455, 60)];
  // Pour la Terre : la Lune.
  assert.equal(nearestIndex(bodies, 2), 4);
  // Pour la Lune : la Terre.
  assert.equal(nearestIndex(bodies, 4), 2);
  // Pour le Soleil : Vénus.
  assert.equal(nearestIndex(bodies, 0), 1, 'Soleil → Vénus');
// Fin du test.
});

// Test : les astres masqués.
test('astres masqués ignorés, aucun candidat → −1', () => {
  // Mars et la Lune masqués.
  const bodies = [at(0), at(17000), at(23455), null, null];
  // Pour la Terre : Vénus.
  assert.equal(nearestIndex(bodies, 2), 1, 'Lune masquée : Vénus devient la plus proche de la Terre');
  // Aucun autre astre : -1.
  assert.equal(nearestIndex([at(0), null], 0), -1);
  // Astre focus sans position : -1.
  assert.equal(nearestIndex([null, at(1)], 0), -1, 'astre focus sans position');
// Fin du test.
});

// Test : les réglages de caméra gardés.
test('réglages de caméra gardés pour le retour à la position d’origine', () => {
  // Un moteur d'essai, avec un réglage en trop.
  const engine = { az: 1, el: 0.2, dist: 5, distGoal: 4, heading: 0.1, headingGoal: 0.1, pilotTilt: null, tiltV: 0.3, autre: 9 };
  // Sauvegarde ses réglages.
  const saved = saveCamera(engine);
  // Seules les clés prévues sont gardées, dans l'ordre.
  assert.deepEqual(Object.keys(saved), LOCK_SAVED_KEYS);
  // La distance est gardée.
  assert.equal(saved.dist, 5);
  // Une valeur nulle est gardée telle quelle.
  assert.equal(saved.pilotTilt, null);
  // Le réglage en trop n'est pas gardé.
  assert.equal('autre' in saved, false);
// Fin du test.
});
