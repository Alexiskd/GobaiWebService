// Tests des calculs de la charge électrique du Soleil (chargeSoleil.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONSTANTES, LIGNES_SYNTHESE, SEUIL_IONISATION, facteurBoltzmann, qCouronne, qIonisee, qNette, rapportVitesses, tauxIonisation } from './chargeSoleil.js';

test('Q_nette = 2π ε₀ G (m_p − m_e) M☉ / e ≈ +77 C', () => {
  assert.ok(qNette() > 76.5 && qNette() < 77.5, qNette());
});

test('Q_couronne = 4π ε₀ R☉ k_B T / e ≈ +10 C à 1,5 × 10⁶ K, linéaire en T', () => {
  assert.ok(qCouronne(CONSTANTES.T_COURONNE) > 9.5 && qCouronne(CONSTANTES.T_COURONNE) < 10.5, qCouronne(CONSTANTES.T_COURONNE));
  assert.ok(Math.abs(qCouronne(2 * CONSTANTES.T_COURONNE) - 2 * qCouronne(CONSTANTES.T_COURONNE)) < 1e-6);
});

test('les électrons sont 1 836 fois plus légers, donc ≈ 43 fois plus rapides (et non « 43 fois plus légers »)', () => {
  assert.ok(Math.abs(CONSTANTES.mP / CONSTANTES.mE - 1836.15) < 0.01);
  assert.ok(Math.abs(rapportVitesses() - 42.85) < 0.01, rapportVitesses());
});

test('facteur de Boltzmann : infime à 10 000 K, proche de 1 au cœur', () => {
  assert.ok(facteurBoltzmann(1e4) < 1e-6);
  assert.ok(facteurBoltzmann(CONSTANTES.T_COEUR) > 0.98 && facteurBoltzmann(CONSTANTES.T_COEUR) < 1);
});

test('Saha : x ≈ 10⁻⁴ dans la photosphère, croissant avec T, toujours entre 0 et 1', () => {
  const x = tauxIonisation(CONSTANTES.T_PHOTOSPHERE);
  assert.ok(x > 5e-5 && x < 5e-4, x);
  for (let i = 1; i < SEUIL_IONISATION.length; i += 1) assert.ok(SEUIL_IONISATION[i][1] > SEUIL_IONISATION[i - 1][1]);
  assert.ok(tauxIonisation(20000) > 0.9 && tauxIonisation(20000) < 1);
  assert.ok(tauxIonisation(1e8) <= 1 && tauxIonisation(100) >= 0);
});

test('Saha : x vérifie bien x² / (1 − x) = S / n, et diminue quand la densité augmente', () => {
  const T = 10000, n = 1e23, x = tauxIonisation(T, n);
  const s = ((2 * Math.PI * CONSTANTES.mE * CONSTANTES.kB * T) / (6.62607015e-34 ** 2)) ** 1.5 * facteurBoltzmann(T) / n;
  assert.ok(Math.abs((x * x) / (1 - x) / s - 1) < 1e-9);
  assert.ok(tauxIonisation(T, 1e25) < x);
});

test('Q₊ du Soleil totalement ionisé ≈ 1,65 × 10³⁸ C, proportionnelle à x', () => {
  assert.ok(qIonisee() > 1.6e38 && qIonisee() < 1.7e38, qIonisee());
  assert.ok(Math.abs(qIonisee(0.5) / qIonisee() - 0.5) < 1e-12);
  assert.ok(Math.abs(CONSTANTES.X + CONSTANTES.Y + CONSTANTES.Z - 1) < 1e-12);
});

test('tableau de synthèse : 3 lignes complètes', () => {
  assert.equal(LIGNES_SYNTHESE.length, 3);
  for (const l of LIGNES_SYNTHESE) assert.ok(l.grandeur && l.formule && l.note && Number.isFinite(l.valeur) && l.valeur > 0, l.grandeur);
});
