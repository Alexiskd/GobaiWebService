// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { EARTH_NIGHT_LIGHTS, LIGHTS_FULL, LIGHTS_MOSAIC_LEVEL, LIGHTS_ON_START, assembleLightsMosaic, bloomWeights, cityLight, mosaicTiles, nightLightsChoice, nightWeight } from './nightLights.jsx';
// Importe le shader de fragments des tuiles.
import { tileFragmentShader } from './tileShaders.jsx';

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

// Test : tuiles de la mosaïque mondiale.
test('la mosaïque mondiale couvre toute la Terre, ligne par ligne', () => {
  // Niveau 1 : quatre tuiles, du nord-ouest au sud-est.
  assert.deepEqual(mosaicTiles(1), [{ z: 1, x: 0, y: 0 }, { z: 1, x: 1, y: 0 }, { z: 1, x: 0, y: 1 }, { z: 1, x: 1, y: 1 }]);
  // Niveau de la mosaïque, sur tous les appareils : 256 tuiles.
  assert.equal(mosaicTiles(LIGHTS_MOSAIC_LEVEL).length, 256);
// Fin du test.
});

// Test : assemblage.
test('assemble les lumières du monde entier, une tuile manquante restant noire', async () => {
  // Dessins faits sur le faux canevas.
  const drawn = [];
  // Faux canevas : enregistre les dessins.
  const canvas = { getContext: () => ({ fillRect() {}, drawImage: (img, x, y) => drawn.push([img, x, y]) }) };
  // Fausse source : la tuile (1, 1) manque.
  const source = { loadImage: (t) => (t.x === 1 && t.y === 1 ? Promise.reject(new Error('absente')) : Promise.resolve(`${t.x},${t.y}`)) };
  // Assemblage au niveau 1.
  const r = await assembleLightsMosaic(source, 1, () => canvas);
  // Canevas de 512 px ; trois tuiles sur quatre.
  assert.equal(canvas.width, 512); assert.equal(r.got, 3); assert.equal(r.total, 4);
  // Chaque tuile à sa place.
  assert.deepEqual(drawn.sort(), [['0,0', 0, 0], ['0,1', 0, 256], ['1,0', 256, 0]]);
// Fin du test.
});

// Test : lumières prononcées.
test('les lampes ressortent, le sol et la mer bleutés de Black Marble sont écartés', () => {
  // Sol bleuté, mer sombre et glace : rien ; sol brunâtre (désert sombre) : presque rien.
  assert.equal(cityLight([0.08, 0.1, 0.15]), 0); assert.equal(cityLight([0.02, 0.04, 0.1]), 0); assert.equal(cityLight([0.3, 0.35, 0.45]), 0); assert.ok(cityLight([0.15, 0.12, 0.1]) < 0.01);
  // Village (faible lumière jaune) : visible.
  assert.ok(cityLight([0.25, 0.2, 0.12]) > 0.2);
  // Grande ville jaune et cœur blanc saturé : plus forts que le village.
  assert.ok(cityLight([0.9, 0.75, 0.45]) > cityLight([0.25, 0.2, 0.12])); assert.ok(cityLight([1, 1, 0.92]) > 1);
// Fin du test.
});

// Test : halo.
test('halo pondéré comme UnrealBloomPass, et les mêmes valeurs dans le shader', () => {
  // Facteurs 1 ; 0,8 ; 0,6 ; 0,4 rapprochés avec un rayon de 0,4.
  assert.deepEqual(bloomWeights(), [0.68, 0.64, 0.6, 0.56]);
  // Rayon nul : les facteurs d'origine.
  assert.deepEqual(bloomWeights(0), [1, 0.8, 0.6, 0.4]);
  // Le shader : mêmes poids, quatre niveaux de flou, même filtre.
  assert.ok(tileFragmentShader.includes('.68*cityLight(texture2D(m,q,1.).rgb)+.64*cityLight(texture2D(m,q,2.).rgb)+.6*cityLight(texture2D(m,q,3.).rgb)+.56*cityLight(texture2D(m,q,4.).rgb)'));
  // Même filtre passe-haut que cityLight.
  assert.ok(tileFragmentShader.includes('float w=max(c.r-.8*c.b,0.);return smoothstep(.05,.3,w)*(.35+dot(c,vec3(.299,.587,.114)));'));
// Fin du test.
});
