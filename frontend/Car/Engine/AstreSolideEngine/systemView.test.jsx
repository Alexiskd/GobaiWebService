// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la vue d'un système planétaire.
import { SYSTEM_EXIT_FACTOR, hillRadius, insideSystem, outsideSystem, systemHostOf } from './systemView.jsx';
// Importe la table des masses.
import { BODY_MASS_KG } from './gravityMath.jsx';

// Kilomètres par unité astronomique.
const AU_KM = 149597870.7;

// Test : rayon du système.
test('le système d’une planète est sa sphère de Hill', () => {
  // Terre à 1 UA : ≈ 1,5 million de km.
  assert.ok(Math.abs(hillRadius(AU_KM, BODY_MASS_KG.earth) - 1.5e6) < 0.05e6);
  // Jupiter à 5,2 UA : ≈ 53 millions de km.
  assert.ok(Math.abs(hillRadius(5.2 * AU_KM, BODY_MASS_KG.jupiter) - 53e6) < 1.5e6);
  // La Lune (384 400 km) est bien dans le système de la Terre.
  assert.ok(hillRadius(AU_KM, BODY_MASS_KG.earth) > 384400);
  // Sans distance ou sans masse : nul.
  assert.equal(hillRadius(0, BODY_MASS_KG.earth), 0); assert.equal(hillRadius(AU_KM, 0), 0);
// Fin du test.
});

// Test : entrée et sortie, avec la marge.
test('entre sous le rayon, ne ressort qu’au-delà de la marge', () => {
  // Dehors, sous le rayon : entre.
  assert.equal(insideSystem(99, 100), true);
  // Dehors, au-delà : reste dehors.
  assert.equal(insideSystem(101, 100), false);
  // Dedans, un peu au-delà du rayon : reste dedans.
  assert.equal(insideSystem(110, 100, true), true);
  // Dedans, au-delà de la marge : sort.
  assert.equal(insideSystem(100 * SYSTEM_EXIT_FACTOR + 1, 100, true), false);
  // Rayon nul : jamais dedans.
  assert.equal(insideSystem(0, 0, true), false);
// Fin du test.
});

// Test : planète du système de la cible.
test('planète du système : elle-même, la Terre pour la Lune, la planète d’un satellite', () => {
  // Fausses planètes.
  const earth = { id: 'earth' }, jupiter = { id: 'jupiter' };
  // Planète ciblée : elle-même.
  assert.equal(systemHostOf({ body: jupiter }, earth), jupiter);
  // Lune : la Terre.
  assert.equal(systemHostOf({ moon: true }, earth), earth);
  // Satellite : sa planète.
  assert.equal(systemHostOf({ satellite: { parent: jupiter } }, earth), jupiter);
  // Soleil, ou rien : aucune.
  assert.equal(systemHostOf({ name: 'Soleil' }, earth), null); assert.equal(systemHostOf(null, earth), null);
  // Hors du système de Jupiter : la Terre ; Jupiter n'en est pas ; sans système : rien n'est hors.
  assert.equal(outsideSystem(jupiter, earth), true); assert.equal(outsideSystem(jupiter, jupiter), false); assert.equal(outsideSystem(null, earth), false);
// Fin du test.
});
