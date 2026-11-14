// Importe test, le lanceur de tests de Node.
import test from 'node:test';
// Importe assert, les vérifications strictes de Node.
import assert from 'node:assert/strict';
// Importe parseDonationReturn, la fonction testée.
import { parseDonationReturn } from './donationReturn';

// Test : un don payé n'est reconnu qu'avec un identifiant de session valide (début).
test('retour de Stripe : don payé, avec un identifiant de session valide seulement', () => {
  // Identifiant de test valide : don payé.
  assert.deepEqual(parseDonationReturn('?don=merci&session_id=cs_test_a1B2c3D4e5F6'), { kind: 'paid', id: 'cs_test_a1B2c3D4e5F6' });
  // Identifiant réel valide, avec un autre paramètre devant : don payé.
  assert.deepEqual(parseDonationReturn('?x=1&don=merci&session_id=cs_live_a1B2c3D4e5F6'), { kind: 'paid', id: 'cs_live_a1B2c3D4e5F6' });
  // Sans identifiant : null.
  assert.equal(parseDonationReturn('?don=merci'), null);
  // Identifiant de forme invalide : null.
  assert.equal(parseDonationReturn('?don=merci&session_id=../../etc'), null);
// Fin du test.
});

// Test : un abandon reprend le don mémorisé s'il existe ; rien sans paramètre (début).
test('retour de Stripe : abandon, avec le don mémorisé s’il existe ; rien sans paramètre', () => {
  // Abandon avec un identifiant gardé.
  assert.deepEqual(parseDonationReturn('?don=annule', 'cs_test_a1B2c3D4e5F6'), { kind: 'cancelled', id: 'cs_test_a1B2c3D4e5F6' });
  // Abandon sans identifiant gardé : identifiant null.
  assert.deepEqual(parseDonationReturn('?don=annule'), { kind: 'cancelled', id: null });
  // Adresse sans paramètre : null.
  assert.equal(parseDonationReturn(''), null);
  // Autre valeur de « don » : null.
  assert.equal(parseDonationReturn('?don=autre'), null);
// Fin du test.
});
