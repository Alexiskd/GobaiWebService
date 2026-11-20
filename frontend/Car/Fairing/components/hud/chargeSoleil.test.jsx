// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les calculs de la charge électrique du Soleil.
import { CONSTANTES, qNette, qCouronne, tauxIonisation, qIonisee, LIGNES_SYNTHESE } from './chargeSoleil.js';

// Test : la charge nette statique (Pannekoek-Rosseland) vaut environ +77 C, indépendamment de T.
test('Q_nette = 2π ε₀ G m_p M☉ / e ≈ +77 C', () => {
  // Entre 70 et 85 C, et strictement positive.
  assert.ok(qNette() > 70 && qNette() < 85, qNette());
  assert.ok(qNette() > 0);
// Fin du test.
});

// Test : la charge coronale vaut ≈ +10 C à T = 1,5 × 10⁶ K, et croît linéairement avec T.
test('Q_couronne = 4π ε₀ R☉ k_B T / e ≈ +10 C à 1,5 × 10⁶ K, linéaire en T', () => {
  // À la température de la couronne : entre 9 et 11 C.
  assert.ok(qCouronne(CONSTANTES.T_COURONNE) > 9 && qCouronne(CONSTANTES.T_COURONNE) < 11, qCouronne(CONSTANTES.T_COURONNE));
  // Linéarité : doubler T double Q.
  assert.ok(Math.abs(qCouronne(2 * CONSTANTES.T_COURONNE) - 2 * qCouronne(CONSTANTES.T_COURONNE)) < 1e-6);
// Fin du test.
});

// Test : le taux d'ionisation Saha démarre vers 10 000 K et vaut ≈ 0,99 au cœur (1,57 × 10⁷ K).
test('x(T) = exp(−χ_H / k_B T) : faible à 10 000 K, ≈ 0,99 au cœur', () => {
  // À 10 000 K : très faible (ionisation qui démarre).
  assert.ok(tauxIonisation(1e4) < 1e-6, tauxIonisation(1e4));
  // Au cœur : entre 0,98 et 1.
  assert.ok(tauxIonisation(CONSTANTES.T_COEUR) > 0.98 && tauxIonisation(CONSTANTES.T_COEUR) <= 1);
// Fin du test.
});

// Test : la charge ionisée totale au cœur vaut ≈ +1,63 × 10³⁸ C.
test('Q₊ au cœur ≈ +1,63 × 10³⁸ C', () => {
  // Entre 1,5 × 10³⁸ et 1,8 × 10³⁸ C.
  const q = qIonisee(CONSTANTES.T_COEUR);
  assert.ok(q > 1.5e38 && q < 1.8e38, q);
// Fin du test.
});

// Test : le tableau de synthèse a trois lignes, avec grandeur, formule et valeur finie.
test('tableau de synthèse : 3 lignes complètes', () => {
  // Trois lignes.
  assert.equal(LIGNES_SYNTHESE.length, 3);
  // Chacune a une grandeur, une formule et une valeur finie strictement positive.
  for (const l of LIGNES_SYNTHESE) assert.ok(l.grandeur && l.formule && Number.isFinite(l.valeur) && l.valeur > 0, l.grandeur);
// Fin du test.
});
