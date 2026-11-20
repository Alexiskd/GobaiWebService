// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les calculs des caractéristiques d'un élément.
import { E_CHARGE, U_KG, NA, chargeNoyau, masseAtomiqueChlore, masseMolaireChlore, defautMasseHelium, energieLiaisonHelium } from './caracteristiquesElement.js';
// Importe les systèmes du tableau hypothétique, pour compter ceux à une seule étoile.
import { SYSTEMES } from './tableauHypothetique.js';

// Test : la charge du noyau vaut +Z·e — pour le Solarium (Z = 119), ≈ 1,91 × 10⁻¹⁷ C.
test('charge du noyau = +Z·e (Solarium Z = 119 → ≈ 1,91 × 10⁻¹⁷ C)', () => {
  // Formule exacte : Z fois la charge élémentaire.
  assert.equal(chargeNoyau(1), E_CHARGE);
  // Pour Z = 119 : entre 1,9 × 10⁻¹⁷ et 1,92 × 10⁻¹⁷ C.
  const q = chargeNoyau(119);
  assert.ok(q > 1.9e-17 && q < 1.92e-17, q);
// Fin du test.
});

// Test : 1 u = 1/12 de la masse du carbone 12, ≈ 1,6605 × 10⁻²⁷ kg ; N_A ≈ 6,022 × 10²³ mol⁻¹.
test('constantes : 1 u ≈ 1,6605 × 10⁻²⁷ kg, N_A ≈ 6,022 × 10²³ mol⁻¹', () => {
  // 1 u entre 1,66 × 10⁻²⁷ et 1,661 × 10⁻²⁷ kg.
  assert.ok(U_KG > 1.66e-27 && U_KG < 1.661e-27, U_KG);
  // N_A entre 6,02 × 10²³ et 6,03 × 10²³.
  assert.ok(NA > 6.02e23 && NA < 6.03e23, NA);
// Fin du test.
});

// Test : la masse atomique du chlore, moyenne pondérée des isotopes 35 et 37, vaut ≈ 35,45 u (= g/mol).
test('A_r(Cl) = 34,9689 × 75,76 % + 36,9659 × 24,24 % ≈ 35,45 u', () => {
  // Entre 35,44 et 35,46 u.
  const ar = masseAtomiqueChlore();
  assert.ok(ar > 35.44 && ar < 35.46, ar);
  // La masse molaire a la même valeur numérique en g/mol.
  assert.equal(masseMolaireChlore(), ar);
// Fin du test.
});

// Test : la comparaison avec les systèmes à une seule étoile — 34 sur 49, sans problème à 3 corps.
test('comparaison : 34 systèmes à une seule étoile (pas de problème à 3 corps) sur 49', () => {
  // Comptés directement sur les systèmes : une seule composante = une seule étoile.
  const mono = SYSTEMES.filter((s) => s.composantes.length === 1).length;
  assert.equal(mono, 34);
  assert.equal(SYSTEMES.length, 49);
// Fin du test.
});

// Défaut de masse de l'hélium 4 et énergie de liaison correspondante.
test('hélium 4 : Δm ≈ 0,0304 u, E = Δm·c² ≈ 28,3 MeV (≈ 7,07 MeV par nucléon)', () => {
  assert.ok(Math.abs(defautMasseHelium() - 0.03038) < 1e-4, defautMasseHelium());
  assert.ok(Math.abs(energieLiaisonHelium() - 28.30) < 0.02, energieLiaisonHelium());
  assert.ok(Math.abs(energieLiaisonHelium() / 4 - 7.07) < 0.01);
});
