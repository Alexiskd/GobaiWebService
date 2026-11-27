// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe la garde de la racine React.
import { getAppRoot, hideSeoShell, setAppRoot, unmountApp } from './appRoot.jsx';

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

// Test : le contenu de départ reste dans la page, rendu inerte.
test('rend le contenu de départ inerte sans le retirer, une seule fois', () => {
  // Un faux nœud qui garde ses attributs.
  const attrs = {};
  const shell = { setAttribute: (k, v) => { attrs[k] = v; }, getAttribute: (k) => attrs[k] ?? null, remove: () => { throw new Error('retiré'); } };
  const doc = { getElementById: (id) => (id === 'seo' ? shell : null) };
  // Premier appel : le nœud est rendu inerte.
  assert.equal(hideSeoShell(doc), true);
  // Attributs posés.
  assert.equal(attrs['aria-hidden'], 'true');
  assert.equal(attrs.translate, 'no');
  assert.equal(attrs.inert, '');
  // Deuxième : déjà fait.
  assert.equal(hideSeoShell(doc), false);
// Fin du test.
});

// Test : sans document, rien ne casse.
test('ne lève rien sans document', () => {
  // Aucun document : le retrait renvoie faux.
  assert.equal(hideSeoShell(undefined), false);
  assert.equal(hideSeoShell({}), false);
// Fin du test.
});
