import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PARSEC_IN_AU,
  createInterstellarEngineConfig,
  globalCameraPosition,
  resolveInterstellarSystemId,
  resolveInterstellarPerivolumeRadius,
  resolveInterstellarFocusDistance,
} from './InterstellarEngineIntegration.js';

test('la conversion parsec utilise la même échelle physique que les UA du Système solaire', () => {
  const config = createInterstellarEngineConfig({ auUnits: 23455 });
  assert.equal(config.parsecToSceneUnits, 23455 * PARSEC_IN_AU);
  assert.equal(config.auToSceneUnits, 23455);
});

test('la configuration rejette une échelle AU invalide', () => {
  assert.throws(() => createInterstellarEngineConfig({ auUnits: 0 }), /strictement positif/);
});

test('la caméra locale est convertie en coordonnées globales avec origine flottante', () => {
  assert.deepEqual(globalCameraPosition({ x: 1, y: 2, z: 3 }, { x: 10, y: 20, z: 30 }), { x: 11, y: 22, z: 33 });
});

test('la conversion caméra refuse les vecteurs incomplets', () => {
  assert.throws(() => globalCameraPosition({ x: 1 }, { x: 0, y: 0, z: 0 }), /vecteurs 3D finis/);
});

test('Proxima reçoit l’identifiant canonique utilisé par les axiomes', () => {
  assert.equal(resolveInterstellarSystemId({ star: { name: 'Proxima Centauri' }, id: 'gaia:123' }), 'system:proxima-centauri');
});

test('les autres systèmes reçoivent un identifiant externe déterministe', () => {
  assert.equal(resolveInterstellarSystemId({ star: { name: 'Alpha Centauri A' }, id: 'Gaia:42' }), 'system:external:gaia-42');
});

test('un identifiant explicitement fourni est conservé', () => {
  assert.equal(resolveInterstellarSystemId({ star: { name: 'Proxima Centauri' } }, 'system:custom'), 'system:custom');
});

test('le périvolume couvre au moins dix UA', () => {
  assert.equal(resolveInterstellarPerivolumeRadius({}, 100, { planets: [] }), 1000);
});

test('le périvolume s’élargit pour couvrir les orbites connues', () => {
  assert.equal(resolveInterstellarPerivolumeRadius({}, 100, { planets: [{ orbit: { semiMajorAxisAu: 20, eccentricity: 0.5 } }] }), 9000);
});

test('le rayon explicite du périvolume est prioritaire', () => {
  assert.equal(resolveInterstellarPerivolumeRadius({ perivolumeRadius: 123 }, 100, { planets: [] }), 123);
});

test('la distance de cadrage prend en compte l’orbite la plus externe', () => {
  assert.equal(resolveInterstellarFocusDistance({ planets: [{ orbit: { semiMajorAxisAu: 1, eccentricity: 0 } }] }, 100, 25), 280);
});

test('la distance de cadrage conserve le minimum par défaut', () => {
  assert.equal(resolveInterstellarFocusDistance({ planets: [] }, 100, 25), 25);
});
