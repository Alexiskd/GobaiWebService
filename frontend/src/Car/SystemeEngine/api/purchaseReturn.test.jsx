// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la lecture du retour de paiement.
import { parsePurchaseReturn } from './purchaseReturn.jsx';

// Test : le retour après paiement.
test('reconnaît un retour de paiement abouti', () => {
  // Une adresse de retour telle que Stripe la fabrique.
  const r = parsePurchaseReturn('?achat=ok&session_id=cs_test_a1B2c3D4e5F6g7H8');
  // Elle est reconnue, avec son identifiant.
  assert.deepEqual(r, { kind: 'paid', id: 'cs_test_a1B2c3D4e5F6g7H8' });
// Fin du test.
});

// Test : l'abandon.
test('reconnaît un abandon', () => {
  // Retour d'abandon.
  assert.deepEqual(parsePurchaseReturn('?achat=annule'), { kind: 'cancelled', id: null });
// Fin du test.
});

// Test : les adresses qui ne sont pas des retours.
test('ignore une adresse qui n’est pas un retour de paiement', () => {
  // Rien, autre chose, ou un identifiant mal formé.
  for (const search of ['', '?x=1', '?achat=ok', '?achat=ok&session_id=bidon', '?achat=ok&session_id=cs_test_court', '?don=merci&session_id=cs_test_a1B2c3D4e5F6g7H8']) {
    // Aucun retour reconnu.
    assert.equal(parsePurchaseReturn(search), null, search);
  // Fin des adresses.
  }
// Fin du test.
});
