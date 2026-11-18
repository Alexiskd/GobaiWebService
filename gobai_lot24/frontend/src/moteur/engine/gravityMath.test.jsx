// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la table des masses et les trois fonctions testées.
import { BODY_MASS_KG, bodyMassKg, dominantBody, formatDistanceKm } from './gravityMath';

// km : fabrique un astre d'essai avec sa masse et sa distance.
const km = (name, distance) => ({ name, massKg: BODY_MASS_KG[name], distance });

// Test : l'astre dominant.
test('astre dominant : la Lune près de son sol, la Terre en orbite basse, le Soleil entre les planètes', () => {
  // À 100 km au-dessus de la Lune.
  // Près de la Lune : la Lune.
  assert.equal(dominantBody([km('moon', 1837), km('earth', 384400), km('sun', 149.6e6)]).name, 'moon');
  // Station spatiale : 400 km au-dessus de la Terre.
  // En orbite basse terrestre : la Terre.
  assert.equal(dominantBody([km('moon', 384000), km('earth', 6771), km('sun', 149.6e6)]).name, 'earth');
  // À mi-chemin entre la Terre et Mars, loin des deux.
  // Entre la Terre et Mars : le Soleil.
  assert.equal(dominantBody([km('earth', 40e6), km('mars', 40e6), km('sun', 190e6)]).name, 'sun');
  // Autour de Titan, Saturne est plus lourde mais plus loin.
  // Près de Titan : Titan, malgré Saturne.
  assert.equal(dominantBody([km('titan', 3000), km('saturn', 1.22e6), km('sun', 1.43e9)]).name, 'titan');
  // Liste vide : null.
  assert.equal(dominantBody([]), null);
// Fin du test.
});

// Test : la masse d'un astre.
test('masse : table, sinon estimation par le rayon', () => {
  // Astre connu : la masse de la table.
  assert.equal(bodyMassKg('earth', 6371), BODY_MASS_KG.earth);
  // Astre inconnu de 500 km de rayon.
  const guess = bodyMassKg('inconnu', 500);
  // Estimation entre 5e20 et 2e21 kg.
  assert.ok(guess > 5e20 && guess < 2e21);
// Fin du test.
});

// Test : l'écriture d'une distance.
test('distance toujours en kilomètres, du sol aux confins du système solaire', () => {
  // clean : remplace les espaces insécables par des espaces simples.
  const clean = (s) => s.replace(/[\u202f\u00a0]/g, ' ');
  // Sous 10 km : deux décimales.
  assert.equal(clean(formatDistanceKm(0.25)), '0,25 km');
  // Sous 100 km : une décimale.
  assert.equal(clean(formatDistanceKm(12.34)), '12,3 km');
  // Distance Terre-Lune : kilomètres entiers.
  assert.equal(clean(formatDistanceKm(384400)), '384 400 km');
  // Millions de kilomètres.
  assert.equal(clean(formatDistanceKm(2.5e6)), '2 500 000 km');
  // Une unité astronomique, arrondie.
  assert.equal(clean(formatDistanceKm(149_597_870.7)), '149 597 871 km');
  // Distance négative : zéro.
  assert.equal(clean(formatDistanceKm(-5)), '0,00 km');
// Fin du test.
});
