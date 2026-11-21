// Importe le lanceur de tests de Node.
import test from 'node:test';
// Importe les assertions strictes.
import assert from 'node:assert/strict';
// Importe la disposition harmonieuse et son emprise.
import { harmoniser, emprise } from './harmonie3d.js';
// Importe l'arborescence du site.
import { SITE_TREE } from '../../../Fairing/components/hud/siteTree.js';

// Compte les nœuds d'une arborescence.
const count = (n) => 1 + n.children.reduce((sum, c) => sum + count(c), 0);

// Test : toute l'arborescence du site est placée.
test('arborescence du site : chaque page reçoit une position, l’accueil à l’origine', () => {
  // Positions calculées.
  const p = harmoniser(SITE_TREE);
  // Autant de positions que de nœuds.
  assert.equal(p.size, count(SITE_TREE));
  // L'accueil est à l'origine.
  assert.deepEqual(p.get(SITE_TREE), [0, 0, 0]);
  // Chaque enfant est au-dessus de son parent.
  const monte = (n) => n.children.every((c) => p.get(c)[1] > p.get(n)[1] && monte(c));
  // Vérifie toute l'arborescence.
  assert.ok(monte(SITE_TREE));
// Fin du test.
});

// Test : résultat stable et borné.
test('arborescence du site : disposition identique à chaque calcul, emprise finie', () => {
  // Deux calculs.
  const a = harmoniser(SITE_TREE), b = harmoniser(SITE_TREE);
  // Mêmes positions.
  assert.deepEqual([...a.values()], [...b.values()]);
  // Emprise positive et finie.
  assert.ok(emprise(a) > 0 && Number.isFinite(emprise(a)));
// Fin du test.
});
