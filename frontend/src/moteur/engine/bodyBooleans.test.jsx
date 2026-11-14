// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la fonction testée.
import { bodyBooleans } from './bodyBooleans.jsx';

// Astres d'essai (début).
const bodies = [
  // Le Soleil.
  { index: 0, name: 'Soleil' },
  // Mars.
  { index: 1, id: 'mars', name: 'Mars' },
  // La Lune.
  { index: 2, id: 'moon', name: 'Lune' },
  // Io.
  { index: 3, id: 'io', name: 'Io' },
  // Un astre inconnu.
  { index: 4, id: 'inconnu', name: 'Inconnu' },
// Fin de la liste.
];
// Disponibilités d'essai : Mars (Trek et JPL) et Io (JPL seulement).
const availability = [{ id: 'mars', trek: true, jpl: true }, { id: 'io', trek: null, jpl: true }];

// Test : une ligne par astre.
test('une ligne par astre, avec ses booléens Trek, JPL et affiché', () => {
  // Avec Io et l'inconnu enlevés, le résultat attendu est (début) :
  assert.deepEqual(bodyBooleans(bodies, availability, [3, 4]), [
    // Le Soleil : sans Trek, avec JPL, affiché.
    { astre: 'Soleil', trek: false, jpl: true, affiche: true },
    // Mars : Trek, JPL, affiché.
    { astre: 'Mars', trek: true, jpl: true, affiche: true },
    // La Lune : Trek, JPL, affichée.
    { astre: 'Lune', trek: true, jpl: true, affiche: true },
    // Io : sans Trek, avec JPL, non affiché.
    { astre: 'Io', trek: false, jpl: true, affiche: false },
    // L'inconnu : tout à faux.
    { astre: 'Inconnu', trek: false, jpl: false, affiche: false },
  // Fin du résultat attendu.
  ]);
// Fin du test.
});

// Test : sans réponse du serveur.
test('test du serveur injoignable : tout est faux sauf le Soleil et la Lune', () => {
  // Pour Mars et la Lune, sans disponibilités (début) :
  assert.deepEqual(bodyBooleans(bodies.slice(1, 3), null, new Set()), [
    // Mars : Trek et JPL à faux, affiché.
    { astre: 'Mars', trek: false, jpl: false, affiche: true },
    // La Lune : Trek et JPL à vrai, affichée.
    { astre: 'Lune', trek: true, jpl: true, affiche: true },
  // Fin du résultat attendu.
  ]);
// Fin du test.
});
