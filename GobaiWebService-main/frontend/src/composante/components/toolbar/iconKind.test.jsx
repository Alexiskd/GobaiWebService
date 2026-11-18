// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe la nature d'une icône.
import { iconKind } from './iconKind.js';

// Test : une icône MUI est un objet memo, pas une fonction.
test('reconnaît une icône MUI (React.memo) comme un composant', () => {
  // Ce que createSvgIcon de MUI rend réellement : memo(forwardRef(…)).
  const forwardRef = { $$typeof: Symbol.for('react.forward_ref'), render: () => null };
  const muiIcon = { $$typeof: Symbol.for('react.memo'), type: forwardRef, compare: null };
  // C'est un composant : sans cela, l'objet finit rendu comme enfant et React lève l'erreur 31.
  assert.equal(iconKind(muiIcon), 'composant');
  // Un forwardRef nu aussi.
  assert.equal(iconKind(forwardRef), 'composant');
  // Et un composant chargé à la demande.
  assert.equal(iconKind({ $$typeof: Symbol.for('react.lazy'), _payload: null }), 'composant');
// Fin du test.
});

// Test : une fonction reste un composant.
test('reconnaît une fonction et une classe comme des composants', () => {
  // Un composant simple.
  assert.equal(iconKind(() => null), 'composant');
  // Une classe.
  assert.equal(iconKind(class Foo {}), 'composant');
// Fin du test.
});

// Test : un élément déjà construit se rend tel quel.
test('reconnaît un élément React déjà construit', () => {
  // Un élément de React 18.
  assert.equal(iconKind({ $$typeof: Symbol.for('react.element'), type: 'span', props: {} }), 'element');
  // Un élément de React 19.
  assert.equal(iconKind({ $$typeof: Symbol.for('react.transitional.element'), type: 'span', props: {} }), 'element');
// Fin du test.
});

// Test : l'image du dossier public.
test('reconnaît une image du dossier public', () => {
  // Le logo de Claude, tel que la barre d'outils le déclare.
  assert.equal(iconKind({ img: '/claude-logo.png' }), 'image');
// Fin du test.
});

// Test : tout le reste est du texte.
test('traite le reste comme du texte', () => {
  // Un caractère, comme la lettre N de la navball.
  assert.equal(iconKind('N'), 'texte');
  // Une chaîne vide, un nombre, l'absence de valeur.
  assert.equal(iconKind(''), 'texte');
  assert.equal(iconKind(0), 'texte');
  assert.equal(iconKind(null), 'texte');
  assert.equal(iconKind(undefined), 'texte');
  // Un objet quelconque, qui n'est ni React ni une image.
  assert.equal(iconKind({ quelconque: true }), 'texte');
// Fin du test.
});
