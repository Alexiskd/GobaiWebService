// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { EARTH_NIGHT_LIGHTS, LIGHTS_FULL, LIGHTS_ON_START, nightLightsChoice, nightWeight } from './nightLights.jsx';

// Test : allumage selon le Soleil.
test('les lumières suivent le Soleil : éteintes de jour, allumées au crépuscule, pleines la nuit', () => {
  // Plein jour (Soleil haut) et Soleil juste au-dessus du début : éteintes.
  assert.equal(nightWeight(0.8), 0); assert.equal(nightWeight(LIGHTS_ON_START), 0);
  // Pleine nuit et nuit profonde : allumées.
  assert.equal(nightWeight(LIGHTS_FULL), 1); assert.equal(nightWeight(-0.9), 1);
  // Crépuscule : à moitié, et croissant quand le Soleil descend.
  assert.equal(nightWeight((LIGHTS_FULL + LIGHTS_ON_START) / 2), 0.5);
  // Plus le Soleil est bas, plus elles brillent.
  assert.ok(nightWeight(-0.1) > nightWeight(-0.03));
// Fin du test.
});

// Test : réglage.
test('Black Marble de GIBS, niveaux 0 à 8, interrupteur gardé dans le navigateur', () => {
  // Adresse WMTS de GIBS, couche Black Marble, jeu de tuiles du niveau 8.
  assert.match(EARTH_NIGHT_LIGHTS.template, /gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/VIIRS_Black_Marble\/default\/2016-01-01\/GoogleMapsCompatible_Level8\/\{z\}\/\{y\}\/\{x\}\.png$/);
  // Niveau le plus fin.
  assert.equal(EARTH_NIGHT_LIGHTS.maxZoom, 8);
  // Interrupteur : allumées sauf « 0 ».
  assert.equal(nightLightsChoice(null), true); assert.equal(nightLightsChoice('0'), false);
// Fin du test.
});
