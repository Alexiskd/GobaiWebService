// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { EARTH_NIGHT_LIGHTS, LIGHTS_FULL, LIGHTS_ON_START, LP_ZONES, NATURAL_KEY, assembleLightsMosaic, bloomWeights, cityLight, mosaicLevelFor, mosaicTiles, naturalColour, nightLightsChoice, nightWeight, recolourPixels } from './nightLights.jsx';
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
test('atlas de la pollution lumineuse 2025, tuiles de 1 024 px niveaux 0 à 6, interrupteur gardé dans le navigateur', () => {
  // Adresse des tuiles 2025 de l'atlas de David Lorenz.
  assert.equal(EARTH_NIGHT_LIGHTS.template, 'https://djlorenz.github.io/astronomy/image_tiles/tiles2025/tile_{z}_{x}_{y}.png');
  // Niveau le plus fin, côté des tuiles et recoloration naturelle.
  assert.equal(EARTH_NIGHT_LIGHTS.maxZoom, 6); assert.equal(EARTH_NIGHT_LIGHTS.tileSize, 1024); assert.equal(EARTH_NIGHT_LIGHTS.natural, true);
  // Interrupteur : allumées sauf « 0 ».
  assert.equal(nightLightsChoice(null), true); assert.equal(nightLightsChoice('0'), false);
// Fin du test.
});

// Test : tuiles de la mosaïque mondiale.
test('la mosaïque mondiale couvre toute la Terre, ligne par ligne', () => {
  // Niveau 1 : quatre tuiles, du nord-ouest au sud-est.
  assert.deepEqual(mosaicTiles(1), [{ z: 1, x: 0, y: 0 }, { z: 1, x: 1, y: 0 }, { z: 1, x: 0, y: 1 }, { z: 1, x: 1, y: 1 }]);
  // Mosaïque de 4 096 px : niveau 4 en tuiles de 256 px (256 tuiles), niveau 2 en tuiles de 1 024 px (16 tuiles).
  assert.equal(mosaicTiles(mosaicLevelFor(256)).length, 256); assert.equal(mosaicTiles(mosaicLevelFor(1024)).length, 16);
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
  // Source en tuiles de 1 024 px : canevas de 2 048 px au niveau 1.
  const big = { getContext: () => ({ fillRect() {}, drawImage() {} }) };
  // Assemblage.
  await assembleLightsMosaic({ tileSize: 1024, loadImage: () => Promise.resolve('t') }, 1, () => big);
  // Taille.
  assert.equal(big.width, 2048);
// Fin du test.
});

// Test : couleurs naturelles.
test('couleurs naturelles : ciel vierge noir, de plus en plus clair et chaud, centres-villes blanc chaud', () => {
  // 15 zones, chacune une couleur de l'atlas.
  assert.equal(LP_ZONES.length, 15); assert.equal(NATURAL_KEY.size, 15);
  // Zone 0 : noir ; zone 7b : blanc chaud.
  assert.deepEqual(naturalColour(0, 0.01), [0, 0, 0]); assert.deepEqual(naturalColour(46.77, 80), [243, 229, 203]);
  // Luminosité de chaque zone.
  const lum = LP_ZONES.map(({ min, max }) => { const [r, g, b] = naturalColour(min, max); return 0.299 * r + 0.587 * g + 0.114 * b; });
  // Strictement croissante d'une zone à la suivante.
  for (let k = 1; k < lum.length; k++) assert.ok(lum[k] > lum[k - 1], LP_ZONES[k].zone);
  // Teinte chaude (rouge ≥ vert ≥ bleu) partout.
  for (const { min, max } of LP_ZONES) { const [r, g, b] = naturalColour(min, max); assert.ok(r >= g && g >= b); }
// Fin du test.
});

// Test : recoloration.
test('recoloration : couleurs exactes de l’atlas et couleur proche d’une zone', () => {
  // Trois pixels : bleu de la zone 2b, blanc de la zone 7b, et un vert un peu altéré (zone 3b).
  const px = new Uint8ClampedArray([33, 84, 216, 255, 242, 242, 242, 255, 30, 160, 44, 128]);
  // Recolorés.
  recolourPixels(px);
  // 2b : brun-orange sombre ; 7b : blanc chaud ; vert altéré : la couleur de la zone 3b, opaque.
  assert.deepEqual([...px], [...naturalColour(0.19, 0.33), 255, ...naturalColour(46.77, 80), 255, ...naturalColour(0.58, 1), 255]);
// Fin du test.
});

// Test : halo.
test('seules les zones les plus lumineuses rayonnent', () => {
  // Zones 0 à 4b : aucun halo.
  for (const { min, max } of LP_ZONES.slice(0, 9)) assert.equal(cityLight(naturalColour(min, max).map((c) => c / 255)), 0);
  // Zones 5a et plus : un halo, croissant.
  const h = LP_ZONES.slice(9).map(({ min, max }) => cityLight(naturalColour(min, max).map((c) => c / 255)));
  // Positifs et croissants.
  h.forEach((v, k) => { assert.ok(v > 0); if (k) assert.ok(v > h[k - 1]); });
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
  assert.ok(tileFragmentShader.includes('float cityLight(vec3 c){return max(dot(c,vec3(.299,.587,.114))-.35,0.)*1.6;}'));
// Fin du test.
});
