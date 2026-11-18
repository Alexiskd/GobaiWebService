// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe l'analyse pure de la mise en page.
import { MIN_TARGET, auditRects, overlapArea } from './layoutAudit.jsx';

// Fenêtre d'un téléphone (iPhone 15).
const VP = { w: 393, h: 852 };
// Fabrique un élément atteignable de rectangle [x, y, l, h].
const item = (id, [x, y, w, h], extra = {}) => ({ id, label: `n${id}`, rect: { x, y, w, h }, reachable: true, ...extra });

// Test : aire commune.
test('aire commune de deux rectangles', () => {
  // Recouvrement de 10 × 20.
  assert.equal(overlapArea({ x: 0, y: 0, w: 50, h: 50 }, { x: 40, y: 30, w: 50, h: 50 }), 10 * 20);
  // Bords qui se touchent : aucune aire.
  assert.equal(overlapArea({ x: 0, y: 0, w: 50, h: 50 }, { x: 50, y: 0, w: 50, h: 50 }), 0);
// Fin du test.
});

// Test : chevauchements.
test('chevauchement : deux commandes atteignables qui se recouvrent, sauf l’une dans l’autre', () => {
  // Deux boutons de 44 px qui se recouvrent de moitié.
  const res = auditRects([item(0, [10, 10, 44, 44]), item(1, [32, 10, 44, 44])], VP);
  // Un chevauchement.
  assert.equal(res.overlaps.length, 1);
  // Un bouton dans une carte cliquable (ancêtre) : pas un chevauchement.
  assert.equal(auditRects([item(0, [0, 0, 200, 80]), item(1, [10, 10, 44, 44], { ancestors: [0] })], VP).overlaps.length, 0);
  // Côte à côte, bords qui se touchent : rien.
  assert.equal(auditRects([item(0, [0, 0, 44, 44]), item(1, [44, 0, 44, 44])], VP).overlaps.length, 0);
  // Partie visible coupée par un conteneur défilant : seule elle compte (ici, elle ne touche pas l'autre).
  assert.equal(auditRects([item(0, [0, 0, 100, 100], { vis: { x: 0, y: 0, w: 100, h: 40 } }), item(1, [0, 50, 100, 44])], VP).overlaps.length, 0);
// Fin du test.
});

// Test : recouvertes et hors écran.
test('recouverte, hors écran : seulement quand le doigt ne peut vraiment pas l’atteindre', () => {
  // Inatteignable, sans fenêtre modale : recouverte.
  assert.equal(auditRects([item(0, [10, 10, 44, 44], { reachable: false })], VP).occluded.length, 1);
  // Sous une fenêtre modale ouverte : désactivée volontairement.
  assert.equal(auditRects([item(0, [10, 10, 44, 44], { reachable: false, modal: true })], VP).occluded.length, 0);
  // Désactivée : laisse passer le doigt volontairement.
  assert.equal(auditRects([item(0, [10, 10, 44, 44], { reachable: false, disabled: true })], VP).occluded.length, 0);
  // Masquée par le défilement de son conteneur : atteignable en faisant défiler.
  assert.equal(auditRects([item(0, [10, 10, 44, 44], { reachable: false, scrollable: true })], VP).occluded.length, 0);
  // Déborde à droite de l'écran : hors écran.
  assert.equal(auditRects([item(0, [370, 10, 44, 44])], VP).offscreen.length, 1);
  // Déborde mais dans un conteneur défilant : non.
  assert.equal(auditRects([item(0, [370, 10, 44, 44], { scrollable: true })], VP).offscreen.length, 0);
// Fin du test.
});

// Test : cibles tactiles.
test('cible tactile de moins de 44 px : signalée, sauf lien dans le texte ou commande inactive', () => {
  // Seuil : 44 px.
  assert.equal(MIN_TARGET, 44);
  // Bouton de 48 × 28 : petite cible.
  assert.equal(auditRects([item(0, [0, 0, 48, 28])], VP).small.length, 1);
  // Champ dont la ligne fait 33 px mais le cadre 48 : non.
  assert.equal(auditRects([item(0, [0, 0, 200, 33], { target: { w: 220, h: 48 } })], VP).small.length, 0);
  // Lien dans le texte : exempté.
  assert.equal(auditRects([item(0, [0, 0, 60, 16], { inline: true })], VP).small.length, 0);
  // Commande inatteignable : pas une cible.
  assert.equal(auditRects([item(0, [0, 0, 20, 20], { reachable: false, modal: true })], VP).small.length, 0);
// Fin du test.
});
