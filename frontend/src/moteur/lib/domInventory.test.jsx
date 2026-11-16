// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { MAX_LABEL, collectInventory, labelOf, oneLine, roleOf, stateOf } from './domInventory';

/** Élément d'essai : un objet qui répond comme un élément de la page, sans navigateur. */
// Déclare el : reçoit la balise, les attributs, le texte et les propriétés.
const el = (tagName, attrs = {}, textContent = '', props = {}) => ({
  // le nom de la balise, le texte, les propriétés passées,
  tagName, textContent, ...props,
  // et la lecture d'un attribut dans la table fournie.
  getAttribute: (name) => (name in attrs ? attrs[name] : null),
// Fin de el.
});

/** Document d'essai : il renvoie les éléments donnés, quel que soit le sélecteur. */
// Déclare doc : reçoit la liste des éléments.
const doc = (list) => ({ querySelectorAll: () => list });

// Test : le texte ramené à une ligne.
test('inventaire : un libellé tient sur une ligne et reste court', () => {
  // Les espaces multiples et les retours à la ligne deviennent une espace simple.
  assert.equal(oneLine('  Aller   à\n Titan  '), 'Aller à Titan');
  // Un texte plus long que la limite est coupé, avec des points de suspension.
  const long = oneLine('a'.repeat(MAX_LABEL + 20));
  // Il fait la longueur maximale,
  assert.equal(long.length, MAX_LABEL);
  // et finit par des points de suspension.
  assert.ok(long.endsWith('…'));
  // Un texte absent donne une chaîne vide.
  assert.equal(oneLine(), '');
// Fin du test.
});

// Test : le libellé, pris dans l'ordre des sources.
test('inventaire : le libellé vient du nom accessible, puis de l’infobulle, puis du texte', () => {
  // Le nom pour les lecteurs d'écran passe avant le texte.
  assert.equal(labelOf(el('button', { 'aria-label': 'Fermer' }, 'X')), 'Fermer');
  // Sans nom accessible, l'infobulle.
  assert.equal(labelOf(el('button', { title: 'Faire un don' }, '')), 'Faire un don');
  // Sans l'un ni l'autre, le texte.
  assert.equal(labelOf(el('button', {}, 'Galerie')), 'Galerie');
  // Sans rien, le texte d'invite d'un champ.
  assert.equal(labelOf(el('input', { placeholder: 'Rechercher un lieu' }, '')), 'Rechercher un lieu');
  // Sans aucune source : vide.
  assert.equal(labelOf(el('button', {}, '')), '');
// Fin du test.
});

// Test : le rôle.
test('inventaire : le rôle déclaré passe avant celui de la balise', () => {
  // Un rôle déclaré est pris tel quel.
  assert.equal(roleOf(el('div', { role: 'switch' })), 'switch');
  // Une case à cocher garde son type.
  assert.equal(roleOf(el('input', {}, '', { type: 'checkbox' })), 'checkbox');
  // Un champ de texte est un champ de saisie.
  assert.equal(roleOf(el('input', {}, '', { type: 'text' })), 'textbox');
  // Un textarea aussi.
  assert.equal(roleOf(el('textarea')), 'textbox');
  // Un lien est un lien.
  assert.equal(roleOf(el('A')), 'link');
  // Un bouton reste un bouton.
  assert.equal(roleOf(el('BUTTON')), 'button');
// Fin du test.
});

// Test : l'état.
test('inventaire : l’état dit coché, enfoncé, désactivé et ouvert', () => {
  // Une case cochée.
  assert.equal(stateOf(el('input', {}, '', { type: 'checkbox', checked: true })), 'coché');
  // Une case décochée.
  assert.equal(stateOf(el('input', {}, '', { type: 'checkbox', checked: false })), 'décoché');
  // Un interrupteur coché, par son attribut.
  assert.equal(stateOf(el('div', { 'aria-checked': 'true' })), 'coché');
  // Un bouton enfoncé.
  assert.equal(stateOf(el('button', { 'aria-pressed': 'true' })), 'enfoncé');
  // Un menu fermé.
  assert.equal(stateOf(el('button', { 'aria-expanded': 'false' })), 'fermé');
  // Un élément désactivé par sa propriété.
  assert.equal(stateOf(el('button', {}, '', { disabled: true })), 'désactivé');
  // Un élément désactivé par son attribut.
  assert.equal(stateOf(el('div', { 'aria-disabled': 'true' })), 'désactivé');
  // Un bouton ordinaire : aucun état.
  assert.equal(stateOf(el('button', {})), '');
// Fin du test.
});

// Test : le relevé complet.
test('inventaire : numérote les éléments, écarte les muets et garde la table d’exécution', () => {
  // Un bouton, un élément sans libellé, et une case cochée.
  const bouton = el('button', { 'aria-label': 'Galerie' });
  // L'élément sans libellé, qui doit être écarté.
  const muet = el('button', {}, '');
  // La case cochée.
  const caseCochee = el('input', { 'aria-label': 'Orbites' }, '', { type: 'checkbox', checked: true });
  // Le relevé sur ces trois éléments.
  const { elements, byId } = collectInventory(doc([bouton, muet, caseCochee]));
  // Deux éléments retenus : le muet est écarté.
  assert.equal(elements.length, 2);
  // Le premier : identifiant e1, son libellé, son rôle, aucun état.
  assert.deepEqual(elements[0], { id: 'e1', label: 'Galerie', role: 'button' });
  // Le second : identifiant e2, avec son état.
  assert.deepEqual(elements[1], { id: 'e2', label: 'Orbites', role: 'checkbox', state: 'coché' });
  // La table retrouve chaque élément par son identifiant.
  assert.equal(byId.get('e1'), bouton);
  // et le second aussi.
  assert.equal(byId.get('e2'), caseCochee);
  // Un identifiant inconnu ne donne rien.
  assert.equal(byId.get('e9'), undefined);
// Fin du test.
});

// Test : l'exclusion du panneau de Claude.
test('inventaire : les éléments du panneau de Claude sont écartés', () => {
  // Un bouton de l'app, qui n'est dans aucun panneau.
  const dehors = { ...el('button', { 'aria-label': 'Galerie' }), closest: () => null };
  // Un bouton du panneau de Claude : son closest trouve la marque.
  const dedans = { ...el('button', { 'aria-label': 'Fermer' }), closest: (sel) => (sel === '[data-claude-panel]' ? {} : null) };
  // Le relevé sur les deux.
  const { elements } = collectInventory(doc([dehors, dedans]));
  // Un seul élément retenu : celui de l'app.
  assert.equal(elements.length, 1);
  // et c'est bien le bouton Galerie.
  assert.equal(elements[0].label, 'Galerie');
// Fin du test.
});

// Test : sans document.
test('inventaire : sans document, il est vide', () => {
  // Le relevé sur rien.
  const { elements, byId } = collectInventory(null);
  // Aucune ligne,
  assert.deepEqual(elements, []);
  // et une table vide.
  assert.equal(byId.size, 0);
// Fin du test.
});
