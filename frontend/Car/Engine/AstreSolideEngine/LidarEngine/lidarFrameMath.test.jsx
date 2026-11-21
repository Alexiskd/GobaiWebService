// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les fonctions et constantes testées.
import { EARTH_TO_ECEF_Q, LIDAR_FRAME_ALT_M, LIDAR_FRAME_LOCATION, cameraEcefQuat, cameraMoved, distM, lidarFrameUrl, quatAngle, quatMul, shouldShowFrame, toEcef } from './lidarFrameMath.js';

// La caméra de l'adresse de référence : 48.878536° N, 2.303039° E, à 132,39 m d'altitude ellipsoïdale, donne les
// paramètres px/py/pz de l'URL d'origine (à deux centimètres près) : la conversion ECEF est la bonne.
const ORIGIN_URL = { px: 4199312.431357034, py: 168884.9253206305, pz: 4781785.735597529 };

// Test : la conversion géodétique → ECEF reproduit la caméra de l'adresse de référence.
test('lidarFrame : la position GPS de la caméra retrouve les paramètres de l’URL', () => {
  // La conversion des coordonnées de référence.
  const [x, y, z] = toEcef(48.878536, 2.303039, 132.39);
  // Chaque coordonnée est à un mètre près de celle de l'URL.
  assert.ok(Math.abs(x - ORIGIN_URL.px) < 1, `x : ${x}`);
  assert.ok(Math.abs(y - ORIGIN_URL.py) < 1, `y : ${y}`);
  assert.ok(Math.abs(z - ORIGIN_URL.pz) < 1, `z : ${z}`);
// Fin du test.
});

// Test : le changement de base vers l'ECEF est un quart de tour autour de +X, et l'identité y reste simple.
test('lidarFrame : le quaternion de base Terre → ECEF', () => {
  // Ses composantes : (√2/2, 0, 0, √2/2).
  assert.deepEqual(EARTH_TO_ECEF_Q, [Math.SQRT1_2, 0, 0, Math.SQRT1_2]);
  // Une caméra droit debout dans le repère de la Terre (identité) devient le quart de tour lui-même.
  assert.deepEqual(cameraEcefQuat([0, 0, 0, 1]), EARTH_TO_ECEF_Q);
  // Le produit avec son conjugué donne l'identité.
  const conj = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
  const id = quatMul(EARTH_TO_ECEF_Q, conj);
  assert.ok(Math.abs(id[0]) < 1e-12 && Math.abs(id[3] - 1) < 1e-12);
// Fin du test.
});

// Test : l'ouverture du cadre suit l'altitude (0,22 km) et la distance à la position de référence.
test('lidarFrame : ouverture sous 0,22 km et près de la référence', () => {
  // À 100 m au-dessus de la référence : ouvert.
  assert.equal(shouldShowFrame({ lat: LIDAR_FRAME_LOCATION.lat, lon: LIDAR_FRAME_LOCATION.lon, altM: 100 }), true);
  // À 219 m : encore ouvert ; à 220 m exactement : fermé.
  assert.equal(shouldShowFrame({ lat: LIDAR_FRAME_LOCATION.lat, lon: LIDAR_FRAME_LOCATION.lon, altM: 219 }), true);
  assert.equal(shouldShowFrame({ lat: LIDAR_FRAME_LOCATION.lat, lon: LIDAR_FRAME_LOCATION.lon, altM: 220 }), false);
  // À 3000 m : fermé.
  assert.equal(shouldShowFrame({ lat: LIDAR_FRAME_LOCATION.lat, lon: LIDAR_FRAME_LOCATION.lon, altM: 3000 }), false);
  // À 100 m mais à 10 km de la référence : fermé.
  assert.equal(shouldShowFrame({ lat: LIDAR_FRAME_LOCATION.lat + 0.09, lon: LIDAR_FRAME_LOCATION.lon, altM: 100 }), false);
  // Coordonnée manquante : fermé.
  assert.equal(shouldShowFrame({ lat: NaN, lon: 2.3, altM: 100 }), false);
// Fin du test.
});

// Test : la distance au sol et l'angle entre rotations.
test('lidarFrame : distances et angles', () => {
  // Un degré de latitude : environ 111 km.
  assert.ok(Math.abs(distM([48.88, 2.3], [49.88, 2.3]) - 111_195) < 500);
  // Deux orientations identiques : angle nul ; une rotation de 180° : angle π (une rotation et son inverse, q et
  // -q, sont la même orientation : l'angle reste nul).
  assert.equal(quatAngle([0, 0, 0, 1], [0, 0, 0, 1]), 0);
  assert.equal(quatAngle([0, 0, 0, 1], [0, 0, 0, -1]), 0);
  assert.ok(Math.abs(quatAngle([0, 0, 0, 1], [1, 0, 0, 0]) - Math.PI) < 1e-12);
// Fin du test.
});

// Test : les seuils de rechargement de la visionneuse.
test('lidarFrame : la caméra doit assez bouger pour recharger', () => {
  // Premier état : toujours vrai.
  assert.equal(cameraMoved(null, { lat: 48.88, lon: 2.3, altM: 100, q: [0, 0, 0, 1] }), true);
  // Un déplacement de 30 m : vrai.
  assert.equal(cameraMoved({ lat: 48.88, lon: 2.3, altM: 100, q: [0, 0, 0, 1] }, { lat: 48.88027, lon: 2.3, altM: 100, q: [0, 0, 0, 1] }), true);
  // Un déplacement de 10 m mais 4° d'orientation : vrai (le seuil d'orientation, 3°, est franchi).
  assert.equal(cameraMoved({ lat: 48.88, lon: 2.3, altM: 100, q: [0, 0, 0, 1] }, { lat: 48.88009, lon: 2.3, altM: 105, q: [Math.sin(Math.PI / 90), 0, 0, Math.cos(Math.PI / 90)] }), true);
  // Un déplacement de 0,5 m et un dixième de degré : faux.
  assert.equal(cameraMoved({ lat: 48.88, lon: 2.3, altM: 100, q: [0, 0, 0, 1] }, { lat: 48.8800045, lon: 2.3, altM: 100.1, q: [Math.sin(Math.PI / 3600), 0, 0, Math.cos(Math.PI / 3600)] }), false);
// Fin du test.
});

// Test : l'adresse de la visionneuse porte les six paramètres.
test('lidarFrame : l’adresse de la visionneuse', () => {
  // L'adresse pour l'état de référence.
  const url = lidarFrameUrl({ lat: 48.878536, lon: 2.303039, altM: 132.39, q: [0.5733196293646728, 0.5968460605579203, 0.4048194604230939, 0.38884519676138546] });
  // Elle commence par l'adresse de la visionneuse.
  assert.ok(url.startsWith('https://visionneuse-lidarhd.ign.fr/?'));
  // Elle porte px et pz proches de l'URL d'origine.
  assert.ok(url.includes(`px=${ORIGIN_URL.px.toFixed(2)}`), url);
  assert.ok(url.includes(`pz=${ORIGIN_URL.pz.toFixed(2)}`), url);
  // Elle porte le quaternion au millionième.
  assert.ok(url.includes('qw=0.388845'), url);
  // Une altitude négative est ramenée au sol sans erreur.
  assert.doesNotThrow(() => lidarFrameUrl({ lat: 48.87, lon: 2.3, altM: -5, q: [0, 0, 0, 1] }));
  // L'altitude d'ouverture reste 220 m.
  assert.equal(LIDAR_FRAME_ALT_M, 220);
// Fin du test.
});
