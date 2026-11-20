// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le calcul des largeurs des tuiles de caractéristiques.
import { largeurs } from './factsLayout.js';

// Une caractéristique courte : valeur et note brèves.
const courte = (term) => ({ term, value: '3 474,8 km' });
// Une caractéristique longue : sa valeur ne tient pas dans une demi-colonne.
const longue = (term) => ({ term, value: 'Premier quartier · 52 % éclairée' });

// Test : deux tuiles courtes partagent une ligne.
test('deux caractéristiques courtes se partagent la ligne', () => {
  assert.deepEqual(largeurs([courte('a'), courte('b')]), [false, false]);
});

// Test : une tuile longue prend toute la ligne.
test('une caractéristique longue prend la ligne entière', () => {
  assert.deepEqual(largeurs([courte('a'), courte('b'), longue('c')]), [false, false, true]);
});

// Test : une tuile courte qui resterait seule s'étire (avant une longue, ou en fin de liste).
test('une caractéristique courte isolée s’étire', () => {
  assert.deepEqual(largeurs([courte('a'), longue('b'), courte('c')]), [true, true, true]);
  assert.deepEqual(largeurs([courte('a'), courte('b'), courte('c')]), [false, false, true]);
});

// Test : une note longue suffit à élargir la tuile.
test('une note longue élargit la tuile', () => {
  assert.deepEqual(largeurs([{ term: 'a', value: '1 km', note: 'point de la Lune vu au centre depuis la Terre' }]), [true]);
});
