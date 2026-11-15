// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions testées.
import { ATMOSPHERE_DEFAULTS, cycloneHint, fireHint, sanitizeAtmosphere } from './atmosphereSettings';

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
