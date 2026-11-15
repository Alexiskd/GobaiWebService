// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { LIGHTNING_LOOP_S, MAX_STRIKES, buildStrikeAttributes, normalizeStrikes, replayOffset, strikeStrength } from './lightningMath';

// Test : les colonnes du serveur.
test('foudre : les colonnes du serveur deviennent des impacts, sans valeur illisible', () => {
  // Colonnes : un impact nuage-sol, un hors du globe, une nature inconnue.
  const s = normalizeStrikes({ lon: [5.2, 200, 6], lat: [45.1, 0, 46], ageS: [30, 0, 10], kind: [1, 1, 7], peak: [-23000, 0, 500], conf: [0.9, 1, 0.4] });
  // Deux impacts gardés.
  assert.equal(s.length, 2);
  // Le premier, recopié.
  assert.deepEqual(s[0], { lon: 5.2, lat: 45.1, ageS: 30, kind: 1, peak: -23000, conf: 0.9 });
  // Nature illisible : inconnue.
  assert.equal(s[1].kind, 0);
  // Réponse vide : aucun impact ; maximum respecté.
  assert.deepEqual(normalizeStrikes(null), []);
  // Colonnes démesurées : coupées.
  assert.equal(normalizeStrikes({ lon: new Array(MAX_STRIKES + 5).fill(1), lat: new Array(MAX_STRIKES + 5).fill(1) }).length, MAX_STRIKES);
// Fin du test.
});

// Test : la relecture.
test('foudre : la relecture garde l’ordre et les écarts réels, accélérés ×10', () => {
  // Le plus ancien au début, le plus récent à la fin.
  assert.deepEqual([replayOffset(300), replayOffset(150), replayOffset(0)], [0, LIGHTNING_LOOP_S / 2, LIGHTNING_LOOP_S]);
  // 60 s d'écart réel : 6 s dans la boucle.
  assert.equal(replayOffset(100) - replayOffset(160), 6);
  // Au-delà de la fenêtre : borné.
  assert.equal(replayOffset(900), 0);
// Fin du test.
});

// Test : la force et les tableaux.
test('foudre : force selon le courant de crête, tableaux du shader', () => {
  // 1 000 → 0, 10 000 → 0,5, 100 000 et plus → 1, signe ignoré.
  assert.deepEqual([strikeStrength(1000), strikeStrength(-10000), strikeStrength(1e6), strikeStrength(null)], [0, 0.5, 1, 0]);
  // Un impact.
  const a = buildStrikeAttributes([{ lon: 0, lat: 0, ageS: 150, kind: 2, peak: 10000, conf: 0.8 }]);
  // Sur l'axe x.
  assert.deepEqual([...a.position].map((v) => Math.round(v * 1e6) / 1e6 + 0), [1, 0, 0]);
  // Moment de relecture, nature, force, confiance.
  assert.deepEqual([...a.strike].map((v) => Math.round(v * 1e3) / 1e3), [15, 2, 0.5, 0.8]);
// Fin du test.
});
