// Importe test, le lanceur de tests intégré à Node.
import { test } from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe ce qui est testé.
import { EARTH_NIGHT_LIGHTS, LIGHTS_FULL, LIGHTS_MOSAIC_PX, LIGHTS_ON_START, LP_ZONES, NATURAL_KEY, assembleLightsMosaic, bloomWeights, bsplineWeights, cityLight, haloWeights, LIGHTS_PREFETCH_MAX, lightsFallback, lightsPrefetchList, mosaicLevelFor, mosaicTiles, naturalColour, nightLightsChoice, nightWeight, recolourPixels } from './nightLights.jsx';
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
  // Mosaïque permanente de 2 048 px : niveau 3 en tuiles de 256 px (64 tuiles), niveau 1 en tuiles de 1 024 px (4 tuiles).
  assert.equal(LIGHTS_MOSAIC_PX, 2048); assert.equal(mosaicTiles(mosaicLevelFor(256)).length, 64); assert.equal(mosaicTiles(mosaicLevelFor(1024)).length, 4);
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
  // Le shader : mêmes poids, quatre niveaux de flou de la mosaïque mondiale, chacun pesé par le flou qu'il apporte.
  for (const [k, w] of [[1, '.68'], [2, '.64'], [3, '.6'], [4, '.56']]) assert.ok(tileFragmentShader.includes(`${w}*clamp(l+${k}.,0.,1.)*cityLight(lightRead(lgMap,q,max(l+${k}.,0.)))`), `niveau ${k}`);
  // Même filtre passe-haut que cityLight.
  assert.ok(tileFragmentShader.includes('float cityLight(vec3 c){return max(dot(c,vec3(.299,.587,.114))-.35,0.)*1.6;}'));
// Fin du test.
});

// Test : halo selon l'échelle.
test('halo d’objectif : plein vu de loin, effacé en zoomant, sans jamais éclaircir les villes vues de près', () => {
  // Mosaïque réduite (vue lointaine) : les quatre poids entiers.
  assert.deepEqual(haloWeights(0.5), bloomWeights());
  // Mosaïque très agrandie (vue rapprochée) : aucun halo.
  assert.deepEqual(haloWeights(-4), [0, 0, 0, 0]);
  // Entre les deux : le halo baisse à mesure qu'on s'approche, sans saut.
  const total = (l) => haloWeights(l).reduce((a, b) => a + b, 0);
  // Décroissant de −0,5 à −4 par pas d'un quart.
  for (let l = -0.5; l > -4; l -= 0.25) assert.ok(total(l - 0.25) <= total(l) && total(l) - total(l - 0.25) <= 0.7);
// Fin du test.
});

// Test : interpolation bicubique.
test('agrandissement bicubique : poids positifs, de somme 1, symétriques', () => {
  // Plusieurs positions entre deux pixels.
  for (const f of [0, 0.25, 0.5, 0.9]) {
    // Les poids.
    const w = bsplineWeights(f);
    // Positifs, de somme 1.
    assert.ok(w.every((v) => v >= 0)); assert.ok(Math.abs(w.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  // Fin de la boucle.
  }
  // Symétrie : f et 1 − f donnent les mêmes poids, inversés.
  assert.deepEqual(bsplineWeights(0.25).map((v) => v.toFixed(12)), bsplineWeights(0.75).reverse().map((v) => v.toFixed(12)));
  // Le shader agrandit en bicubique et réduit par mipmaps.
  assert.ok(tileFragmentShader.includes('vec3 lightCore(sampler2D m,vec2 q,vec2 sz,float l){lightBase=l;if(l>0.)return lightRead(m,q,l);'));
  // Lecture à niveau imposé, avec un repli par biais sans l'extension de WebGL 1 (directives sur leurs propres lignes).
  assert.ok(tileFragmentShader.includes('\n#if defined(texture2DLodEXT)||defined(GL_EXT_shader_texture_lod)\n'));
  assert.ok(tileFragmentShader.includes('\n#else\nvec3 lightTap(sampler2D m,vec2 q,float l){return texture2D(m,q,l-lightBase).rgb;}\n#endif\n'));
  // Sans elle, agrandissement bilinéaire (le bicubique fausserait le niveau de détail).
  assert.ok(tileFragmentShader.includes('\n#ifndef LIGHT_LOD\nreturn lightRead(m,q,l);\n#endif\n'));
// Fin du test.
});

// Test : repli.
test('repli d’une tuile en attendant ses lumières : l’ancêtre chargé le plus proche, et sa portion', () => {
  // Tuiles chargées : le niveau 3 et le niveau 1 au-dessus de la tuile (6, 33, 22).
  const loaded = new Map([['3/4/2', 'img3'], ['1/1/0', 'img1']]);
  // Tuile voulue (6, 33, 22), affichée au niveau 8 (132, 88) : l'ancêtre du niveau 3, le plus proche.
  const fb = lightsFallback(loaded, { z: 6, x: 33, y: 22 }, { z: 8, x: 132, y: 88 });
  // Image du niveau 3 ; portion de 1/32 de côté.
  assert.equal(fb.img, 'img3'); assert.equal(fb.rect[2], 1 / 32);
  // Portion : colonne 132 − 4 × 32 = 4, rangée 88 − 2 × 32 = 24 (v vers le haut).
  assert.deepEqual(fb.rect, [4 / 32, 1 - 25 / 32, 1 / 32, 1 / 32]);
  // Rien de chargé au-dessus : null (la mosaïque mondiale prend le relais).
  assert.equal(lightsFallback(new Map(), { z: 6, x: 33, y: 22 }, { z: 6, x: 33, y: 22 }), null);
// Fin du test.
});

// Test : continuité dans le shader.
test('shader : repli puis fondu, mosaïque mondiale permanente, lectures sûres hors des conditions', () => {
  // Niveaux de détail calculés avant toute condition.
  assert.ok(tileFragmentShader.includes('float ltL=lightLod(ltQ*ltSize),lpL=lightLod(lpQ*ltSize),lgL=lightLod(lgQ*lgSize);'));
  // Repli : l'ancêtre, sinon la mosaïque ; la tuile fine en fondu par-dessus.
  assert.ok(tileFragmentShader.includes('vec3 cc=lpHas>.5?lightCore(lpMap,lpQ,ltSize,lpL):(lgOn>.5?lightCore(lgMap,lgQ,lgSize,lgL):vec3(0.));core=ltHas>.5?mix(cc,lightCore(ltMap,ltQ,ltSize,ltL),ltFade):cc;'));
  // Lecture en lumière linéaire (images en sRGB) ramenée à l'affichage par la courbe sRGB exacte.
  assert.ok(tileFragmentShader.includes('return ltLinear>.5?lightEnc(c):c;'));
  assert.ok(tileFragmentShader.includes('mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(.0031308,c))'));
// Fin du test.
});

// Test : préchargement des zones voisines.
test('préchargement des lumières voisines : une demande par tuile native, la plus utile d’abord, sans les chargées, plafonnée', () => {
  // Quatre tuiles affichées au niveau 8 : deux dans la tuile native (6, 33, 22), une dans (6, 34, 22), une dans (6, 33, 23).
  const tiles = [{ z: 8, x: 132, y: 88, p: 5 }, { z: 8, x: 133, y: 88, p: 2 }, { z: 8, x: 136, y: 88, p: 9 }, { z: 8, x: 132, y: 92, p: 1 }];
  // Rien de chargé : trois tuiles natives, par priorité (la plus forte de leurs tuiles).
  assert.deepEqual(lightsPrefetchList(tiles, 6, new Map()).map((l) => [l.key, l.p]), [['6/33/23', 1], ['6/33/22', 2], ['6/34/22', 9]]);
  // La tuile (6, 33, 22) déjà chargée : écartée.
  assert.deepEqual(lightsPrefetchList(tiles, 6, new Map([['6/33/22', {}]])).map((l) => l.key), ['6/33/23', '6/34/22']);
  // Plafond.
  assert.equal(lightsPrefetchList(tiles, 6, new Map(), 2).length, 2);
  // Plafond par défaut : 8 tuiles natives.
  assert.equal(LIGHTS_PREFETCH_MAX, 8);
  // Tuiles moins fines que l'atlas : la tuile elle-même.
  assert.deepEqual(lightsPrefetchList([{ z: 3, x: 4, y: 2, p: 0 }], 6, new Map())[0].coord, { z: 3, x: 4, y: 2 });
// Fin du test.
});
