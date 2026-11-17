// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les constantes et les fonctions testées.
import { CLOUD_TOP, CLOUD_VISUAL, cloudZoomFactor, depthKmAt, gasShells, interiorReadout, shellAt } from './gasInteriorMath';

// Test : les coquilles de Jupiter.
test('intérieur de Jupiter : coquilles jointives du sommet des nuages au centre', () => {
  // Ses coquilles.
  const shells = gasShells('jupiter');
  // Six couches, des nuages d'ammoniac au noyau.
  assert.deepEqual(shells.map((s) => s.kind), ['ammoniaIce', 'ammoniumHydrosulfide', 'waterCloud', 'molecularH', 'metallicH', 'rock']);
  // La première commence au sommet des nuages.
  assert.equal(shells[0].outer, CLOUD_TOP);
  // Chaque coquille commence où finit la précédente.
  for (let i = 1; i < shells.length; i++) assert.ok(Math.abs(shells[i].outer - shells[i - 1].inner) < 1e-12);
  // La dernière va jusqu'au centre.
  assert.equal(shells.at(-1).inner, 0);
  // Chaque couleur est un code hexadécimal.
  assert.ok(shells.every((s) => /^#[0-9a-f]{6}$/.test(s.color)));
// Fin du test.
});

// Test : la couche traversée.
test('intérieur de Jupiter : couche traversée selon la distance au centre', () => {
  // Au-dessus des nuages : aucune.
  assert.equal(shellAt('jupiter', 1.2), null);
  // Juste sous le sommet : l'ammoniac.
  assert.equal(shellAt('jupiter', 0.99).formula, 'NH₃');
  // Une couche et demie plus bas : l'hydrosulfure d'ammonium.
  assert.equal(shellAt('jupiter', CLOUD_TOP - 1.5 * CLOUD_VISUAL).formula, 'NH₄SH');
  // Deux couches et demie plus bas : l'eau.
  assert.equal(shellAt('jupiter', CLOUD_TOP - 2.5 * CLOUD_VISUAL).formula, 'H₂O');
  // À 85 % du rayon : l'hydrogène et l'hélium.
  assert.equal(shellAt('jupiter', 0.85).name, 'Hydrogène et hélium');
  // À mi-rayon : l'hydrogène métallique.
  assert.equal(shellAt('jupiter', 0.5).name, 'Hydrogène métallique');
  // Près du centre : le noyau dilué.
  assert.equal(shellAt('jupiter', 0.02).name, 'Noyau dilué');
// Fin du test.
});

// Test : la profondeur réelle.
test('intérieur de Jupiter : profondeur réelle continue, 71 km de nuages, limites à 13 982 et 48 938 km', () => {
  // Le plancher des trois couches de nuages.
  const floor = CLOUD_TOP - 3 * CLOUD_VISUAL;
  // Hors de la planète : 0.
  assert.equal(depthKmAt('jupiter', 1.5), 0);
  // Au plancher des nuages : 71 km.
  assert.ok(Math.abs(depthKmAt('jupiter', floor) - 71) < 1e-6);
  // Juste dessous : toujours 71 km, sans saut.
  assert.ok(Math.abs(depthKmAt('jupiter', floor - 1e-9) - 71) < 0.01);
  // À 80 % du rayon : 13 982 km.
  assert.ok(Math.abs(depthKmAt('jupiter', 0.8) - 13982.2) < 0.5);
  // À 30 % du rayon : 48 938 km.
  assert.ok(Math.abs(depthKmAt('jupiter', 0.3) - 48937.7) < 0.5);
  // Profondeur précédente.
  let prev = -1;
  // En descendant, la profondeur ne diminue jamais.
  for (let f = 1; f >= 0; f -= 0.001) { const d = depthKmAt('jupiter', f); assert.ok(d >= prev); prev = d; }
  // Saturne : pas de modèle.
  assert.equal(depthKmAt('saturn', 0.5), null);
// Fin du test.
});

// Test : le texte du HUD et le zoom.
test('intérieur de Jupiter : texte du HUD et zoom adouci dans les nuages seulement', () => {
  // Hors de la planète : pas de texte.
  assert.equal(interiorReadout('jupiter', 1.01), null);
  // À mi-rayon : la couche et la profondeur.
  assert.match(interiorReadout('jupiter', 0.5), /^intérieur · Hydrogène métallique · ≈ 35\s000 km sous le sommet des nuages$/);
  // Dans les nuages : la formule de l'ammoniac.
  assert.match(interiorReadout('jupiter', 0.99), /NH₃/);
  // Dans les nuages : le zoom est adouci.
  assert.ok(cloudZoomFactor('jupiter', 0.97, 0.9) > 0.9);
  // En profondeur : inchangé.
  assert.equal(cloudZoomFactor('jupiter', 0.5, 0.9), 0.9);
  // Loin de la planète : inchangé.
  assert.equal(cloudZoomFactor('jupiter', 3, 0.9), 0.9);
  // Saturne : inchangé.
  assert.equal(cloudZoomFactor('saturn', 0.97, 0.9), 0.9);
// Fin du test.
});
