// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { ATMOSPHERE_DEFAULTS, cycloneHint, fireHint, lightningHint, sanitizeAtmosphere } from './atmosphereSettings';

// Test : les réglages.
test('atmosphère : réglages bornés, calques éteints par défaut, fenêtre parmi celles proposées', () => {
  // Rien de gardé : valeurs par défaut.
  assert.deepEqual(sanitizeAtmosphere(null), ATMOSPHERE_DEFAULTS);
  // Valeurs hors bornes ou illisibles.
  const s = sanitizeAtmosphere({ fires: { on: 'oui', opacity: 5, intensity: 'x', windowHours: 7 }, cyclones: { on: true, opacity: 0, intensity: 3 } });
  // Incendies : « oui » n'est pas vrai, opacité ramenée à 1, intensité par défaut, fenêtre de 24 h.
  assert.deepEqual(s.fires, { on: false, opacity: 1, intensity: 1, windowHours: 24 });
  // Cyclones : allumés, opacité au minimum, intensité au maximum.
  assert.deepEqual(s.cyclones, { on: true, opacity: 0.1, intensity: 2 });
  // Fenêtre proposée gardée.
  assert.equal(sanitizeAtmosphere({ fires: { windowHours: 6 } }).fires.windowHours, 6);
// Fin du test.
});

// Test : les textes d'aide des incendies.
test('atmosphère : le texte des incendies distingue les points chauds des incendies confirmés', () => {
  // Réponse d'essai : 3 + 2 points chauds, un incendie confirmé, une source en panne.
  const t = fireHint({ cells: { n: [3, 2] }, confirmed: [{}], stale: true });
  // Points chauds non confirmés.
  assert.match(t, /^5 points chauds détectés en 24 h \(non confirmés\)/);
  // Un incendie confirmé, au singulier.
  assert.match(t, /1 incendie confirmé \(anneaux\)/);
  // Péremption signalée.
  assert.match(t, /dernières données connues/);
  // Échec.
  assert.match(fireHint('erreur'), /indisponible/);
// Fin du test.
});

// Test : les textes d'aide des cyclones.
test('atmosphère : le texte des cyclones dit clairement quand aucun cyclone actif n’est confirmé', () => {
  // Aucun cyclone, deux suivis écartés.
  assert.match(cycloneHint({ cyclones: [], excluded: [{}, {}] }), /^Aucun cyclone actif confirmé · 2 suivis écartés \(aucune position récente\)/);
  // Un cyclone : son texte court.
  assert.match(cycloneHint({ cyclones: [{ id: 'a', name: 'Pena', lon: -173, lat: 10, details: { category: 'TS', windKt: 50 } }], excluded: [] }), /^Pena · TS 50 kt \(93 km\/h\)/);
// Fin du test.
});

// Test : les textes d'aide de la foudre.
test('atmosphère : le texte de la foudre dit ce qui est mesuré, et pourquoi rien n’arrive', () => {
  // Sans identifiants : la raison.
  assert.match(lightningHint({ available: false, reason: 'Identifiants Xweather absents' }), /^Identifiants Xweather absents/);
  // Accès refusé par l'API : invitation à vérifier l'abonnement.
  assert.match(lightningHint({ available: true, reason: 'Xweather : access denied' }), /vérifier que l'abonnement inclut la foudre/);
  // Données : nombre, natures, fréquence.
  assert.match(lightningHint({ available: true, reason: null, stats: { count: 12, cg: 9, ic: 3, perMin: 2.4 } }), /^12 impacts en 5 min dans 100 km autour du point visé \(9 nuage-sol, 3 intra-nuage, 2.4\/min\)/);
  // Trop loin : invitation à se rapprocher.
  assert.match(lightningHint(null, true), /rapprochez-vous/);
  // Réglages de la foudre bornés.
  assert.deepEqual(sanitizeAtmosphere({ lightning: { on: true, opacity: 3 } }).lightning, { on: true, opacity: 1, intensity: 1 });
// Fin du test.
});
