// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe le modèle d'éclairage testé.
import { EARTH_LIGHT_GLSL, EARTH_TAU, GENERIC_LIGHT_GLSL, SKY_LIGHT, airMass, glintRoughness, sunTransmit } from './surfaceLight.jsx';
// Importe le shader de fragments des tuiles.
import { tileFragmentShader, tileVertexShader } from './MapEngine/tiles/tileShaders.jsx';
// Importe le shader des nuages de la Terre et celui de la coquille.
import { earthCloudFragmentShader, shellFragmentShader } from './AtmosphereEngine/atmosphereShaders.jsx';

// Test : masse d'air.
test('masse d’air : 1 au zénith, ≈ 2 à 60°, ≈ 38 à l’horizon, croissante', () => {
  // Zénith.
  assert.ok(Math.abs(airMass(1) - 1) < 1e-3);
  // 60° du zénith (cosinus 0,5) : environ 2.
  assert.ok(Math.abs(airMass(0.5) - 2) < 0.01);
  // Horizon : environ 38.
  assert.ok(Math.abs(airMass(0) - 38) < 0.5);
  // Plus le Soleil est bas, plus l'air traversé est épais.
  assert.ok(airMass(0.1) > airMass(0.3) && airMass(0.3) > airMass(0.8));
// Fin du test.
});

// Test : transmission.
test('lumière du Soleil : entière au zénith, rougie et assombrie près de l’horizon', () => {
  // Au zénith : 1 pour chaque couleur.
  for (const c of sunTransmit(1)) assert.ok(Math.abs(c - 1) < 1e-3);
  // Soleil à 3° de hauteur : le rouge passe mieux que le vert, qui passe mieux que le bleu.
  const [r, g, b] = sunTransmit(Math.sin((3 * Math.PI) / 180));
  // Ordre des couleurs, et bleu presque éteint.
  assert.ok(r > g && g > b && b < 0.1);
  // Épaisseur optique et lumière du ciel : bleutées.
  assert.ok(EARTH_TAU[2] > EARTH_TAU[0] && SKY_LIGHT[2] > SKY_LIGHT[0]);
// Fin du test.
});

// Test : reflet.
test('reflet sur la mer : rugosité de Cox et Munk pour un vent de 7 m/s', () => {
  // √(0,003 + 0,00512 × 7) ≈ 0,197.
  assert.ok(Math.abs(glintRoughness() - 0.197) < 1e-3);
  // Mer calme : plus lisse.
  assert.ok(glintRoughness(1) < glintRoughness(7));
  // La même valeur (au carré) dans le GLSL.
  assert.ok(EARTH_LIGHT_GLSL.includes(`GLINT_A2=${String(Number((glintRoughness() ** 2).toPrecision(6)))}`));
// Fin du test.
});

// Test : modèle général inchangé.
test('modèle général : les mêmes formules qu’avant, dans les tuiles et la sphère de fond', () => {
  // Part de jour.
  assert.ok(GENERIC_LIGHT_GLSL.includes('mix(smoothstep(-.12,.22,d),smoothstep(-.02,.04,d),airless)'));
  // Couleur éclairée.
  assert.ok(GENERIC_LIGHT_GLSL.includes('mix(col*(.38+.72*m0),col*min(1.4,.04+2.*m0/(m0+mu+.001)),airless)'));
  // Halo bleu du limbe gardé pour le modèle général seulement (ni la Terre ni Jupiter).
  assert.ok(tileFragmentShader.includes("if(surfModel<.5&&gasModel<.5){float fr=pow(1.-mu,3.);base+=vec3(.25,.5,1.)*fr*(.04+.96*dayV)*.65*sh*(1.-airless);}"));
// Fin du test.
});

// Test : modèle de la Terre branché.
test('modèle de la Terre : sol, nuages et coquille branchés', () => {
  // Tuiles : éclairement physique, reflet limité à l'eau, relief éclairé par le Soleil.
  for (const piece of ['earthIrradiance(d,dot(Nt,sunV))', 'if(wm>.01)o+=oceanGlint(N,V,sunV,d,mu)*wm;', 'normalize(N-(rlS.x*normalize(vE)+rlS.y*normalize(vNo))*rlW)']) assert.ok(tileFragmentShader.includes(piece), piece);
  // Directions de l'est et du nord calculées au sommet.
  assert.ok(tileVertexShader.includes('vec3 ea=vec3(normal.z,0.,-normal.x)'));
  // Nuages : même modèle.
  assert.ok(earthCloudFragmentShader.includes('sunTransmit(dc)'));
  // Coquille : la part du fond qui traverse l'air sert d'opacité en perspective aérienne.
  assert.ok(shellFragmentShader.includes('gl_FragColor=vec4(c,aerial>.5?tv:1.);'));
// Fin du test.
});

// Modèle de Jupiter : les deux fonctions GLSL existent, sont appelées avec la bonne signature et sont reliées au shader.
test('le modèle de Jupiter définit jupiterGrade et jupiterLight et le shader des tuiles les utilise', async () => {
  const { JUPITER_LIGHT_GLSL } = await import('./surfaceLight.jsx');
  const { tileFragmentShader } = await import('./MapEngine/tiles/tileShaders.jsx');
  const src = JUPITER_LIGHT_GLSL.join('\n');
  assert.ok(src.includes('vec3 jupiterGrade(vec3 c)') && src.includes('vec3 jupiterLight(vec3 g,float d,float mu)'));
  assert.ok(tileFragmentShader.includes('uniform float gasModel;') && tileFragmentShader.includes('jupiterLight(jupiterGrade(col),d,mu)'));
  // Le halo bleu du modèle général et le modèle de la Terre ne s'appliquent pas à Jupiter.
  assert.ok(tileFragmentShader.includes('surfModel<.5&&gasModel<.5') && tileFragmentShader.includes('else if(surfModel>.5)'));
});
