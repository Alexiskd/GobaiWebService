// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la physique et le code GLSL des cumulonimbus.
import { CUMULONIMBUS, CUMULONIMBUS_GLSL, altitudeAtC, convectiveWeight, cumulonimbusPhase, temperatureC } from './cumulonimbus.jsx';
// Importe le shader des nuages de la Terre, pour vérifier le branchement.
import { earthCloudFragmentShader } from './atmosphereShaders.jsx';

// Test : la température décroît avec l'altitude et altitudeAtC en est l'inverse.
test('cumulonimbus : isotherme 0 °C à 4,5 km, −38 °C à 10,8 km', () => {
  // Au sol : 27 °C.
  assert.equal(temperatureC(0), 27);
  // L'isotherme 0 °C est à 4,5 km.
  assert.ok(Math.abs(altitudeAtC(0) - 4.5) < 1e-9);
  // L'isotherme −38 °C est à 10,833 km, sous le sommet de la tour (12 km).
  assert.ok(Math.abs(altitudeAtC(-38) - 65 / 6) < 1e-9);
  assert.ok(altitudeAtC(-38) < CUMULONIMBUS.topKm);
// Fin du test.
});

// Test : les trois phases de Bergeron.
test('cumulonimbus : liquide sous 0 °C, mixte jusqu\'à −38 °C, glace au-dessus', () => {
  // Sous la base et au-dessus du sommet : pas de nuage.
  assert.deepEqual([cumulonimbusPhase(0.5).liquid, cumulonimbusPhase(0.5).ice], [0, 0]);
  assert.deepEqual([cumulonimbusPhase(13).liquid, cumulonimbusPhase(13).ice], [0, 0]);
  // Entre la base et 0 °C : entièrement liquide.
  assert.deepEqual([cumulonimbusPhase(3).liquid, cumulonimbusPhase(3).ice], [1, 0]);
  // À mi-chemin entre 0 et −38 °C : mélange, la somme liquide + glace vaut 1.
  const mid = cumulonimbusPhase((altitudeAtC(0) + altitudeAtC(-38)) / 2);
  assert.ok(mid.ice > 0.4 && mid.ice < 0.6 && Math.abs(mid.liquid + mid.ice - 1) < 1e-12);
  // Au sommet : glace seule.
  assert.deepEqual([cumulonimbusPhase(11.5).liquid, cumulonimbusPhase(11.5).ice], [0, 1]);
// Fin du test.
});

// Test : la glace ne diminue jamais quand on monte.
test('cumulonimbus : la part de glace croît avec l\'altitude', () => {
  // Part de glace précédente.
  let prev = 0;
  // Du km 1,5 au km 12 par pas de 0,25 km.
  for (let z = CUMULONIMBUS.baseKm; z <= CUMULONIMBUS.topKm; z += 0.25) {
    // Part de glace à cette altitude.
    const { ice } = cumulonimbusPhase(z);
    // Elle ne baisse pas.
    assert.ok(ice >= prev - 1e-12);
    // Mémorise.
    prev = ice;
  // Fin de la boucle.
  }
// Fin du test.
});

// Test : la répartition en latitude.
test('cumulonimbus : fréquents à l\'équateur, rares sous les tropiques secs et aux pôles', () => {
  // Équateur : le plus fort.
  const eq = convectiveWeight(0);
  // Tropiques secs (25°) et pôle.
  const dry = convectiveWeight(25 * Math.PI / 180);
  const pole = convectiveWeight(Math.PI / 2);
  // Ordre attendu.
  assert.ok(eq > 0.5 && dry < 0.1 && pole < 0.01);
  // Symétrique entre hémisphères.
  assert.equal(convectiveWeight(0.7), convectiveWeight(-0.7));
// Fin du test.
});

// Test : le shader des nuages de la Terre contient les cumulonimbus, une seule fois, après le bruit.
test('cumulonimbus : branchés dans le shader des nuages de la Terre', () => {
  // La fonction GLSL est définie dans le code des cumulonimbus.
  assert.ok(CUMULONIMBUS_GLSL.includes('vec2 cumulonimbus(vec3 p)'));
  // Le shader final la contient une seule fois, et l'appelle.
  assert.equal(earthCloudFragmentShader.split('vec2 cumulonimbus(vec3 p)').length - 1, 1);
  assert.ok(earthCloudFragmentShader.includes('cbAt(p)'));
  // Le bruit cHash n'est défini qu'une fois (pas de redéfinition GLSL).
  assert.equal(earthCloudFragmentShader.split('float cHash(vec3 p)').length - 1, 1);
  // La définition du bruit vient avant celle des cumulonimbus qui l'utilise.
  assert.ok(earthCloudFragmentShader.indexOf('float cHash(vec3 p)') < earthCloudFragmentShader.indexOf('vec2 cumulonimbus(vec3 p)'));
// Fin du test.
});
