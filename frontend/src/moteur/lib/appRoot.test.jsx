// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe la garde de la racine React.
import { getAppRoot, removeSeoShell, setAppRoot, unmountApp } from './appRoot.jsx';

/** Fausse racine React : elle compte ses démontages. */
const fakeRoot = (onUnmount) => { let n = 0; return { unmount: () => { n += 1; onUnmount?.(); }, get calls() { return n; } }; };

// Test : le dépôt de la racine.
test('garde la racine déposée', () => {
  // Une fausse racine.
  const root = fakeRoot();
  // Déposée, elle est rendue telle quelle pour l'enchaînement.
  assert.equal(setAppRoot(root), root);
  // Et relisible.
  assert.equal(getAppRoot(), root);
// Fin du test.
});

// Test : le démontage n'a lieu qu'une fois.
test('démonte une seule fois, même appelé plusieurs fois', () => {
  // Une fausse racine.
  const root = fakeRoot();
  // Déposée.
  setAppRoot(root);
  // Premier appel : le démontage a lieu.
  assert.equal(unmountApp(), true);
  // Deuxième et troisième : rien.
  assert.equal(unmountApp(), false);
  assert.equal(unmountApp(), false);
  // React n'a été démonté qu'une fois.
  assert.equal(root.calls, 1);
// Fin du test.
});

// Test : sans racine, le démontage ne lève pas.
test('ne lève rien si aucune racine n’a été déposée', () => {
  // Aucune racine.
  setAppRoot(null);
  // L'appel ne fait rien et ne lève pas.
  assert.equal(unmountApp(), false);
// Fin du test.
});

// Test : un refus de React est avalé.
test('avale un refus de React sans relancer le démontage', () => {
  // Une racine qui lève, comme React pendant un rendu.
  const root = { unmount: () => { throw new Error('Attempted to synchronously unmount a root while React was already rendering.'); } };
  // Déposée.
  setAppRoot(root);
  // L'appel renvoie faux, sans lever.
  assert.equal(unmountApp(), false);
  // Et ne réessaie pas.
  assert.equal(unmountApp(), false);
// Fin du test.
});

// Test : le retrait du contenu de départ.
test('retire le contenu de départ des moteurs de recherche, une seule fois', () => {
  // Un nœud qui se souvient d'avoir été retiré.
  let removed = 0;
  // Un faux document qui ne rend le nœud que la première fois.
  const shell = { remove: () => { removed += 1; shell.gone = true; }, gone: false };
  const doc = { getElementById: (id) => (id === 'seo' && !shell.gone ? shell : null) };
  // Premier appel : le nœud est retiré.
  assert.equal(removeSeoShell(doc), true);
  // Deuxième : il n'y a plus rien à retirer.
  assert.equal(removeSeoShell(doc), false);
  // Un seul retrait.
  assert.equal(removed, 1);
// Fin du test.
});

// Test : sans document, rien ne casse.
test('ne lève rien sans document', () => {
  // Aucun document : le retrait renvoie faux.
  assert.equal(removeSeoShell(undefined), false);
  assert.equal(removeSeoShell({}), false);
// Fin du test.
});
