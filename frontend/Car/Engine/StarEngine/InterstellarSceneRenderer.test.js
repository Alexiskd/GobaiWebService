import test from 'node:test';
import assert from 'node:assert/strict';
import { icrsToHeliocentricParsecs, icrsParsecsToScene, buildInterstellarSystemModel, InterstellarSceneRenderer } from './InterstellarSceneRenderer.js';

const system = (overrides = {}) => ({ id: 'etoile-exemple', kind: 'star-system', identityStatus: 'verified-gaia-identity', star: {
  id: 'gaia:1', name: 'Étoile exemple', coordinates: { raDeg: 217.4289, decDeg: -62.6795, epoch: 2016, frame: 'ICRS' },
  astrometry: { parallaxMas: 768.5 }, propagation: { distancePc: 1.301 },
}, planets: [], ...overrides });

test('ICRS RA=0 Dec=0 place l’étoile sur +X à la distance donnée', () => {
  assert.deepEqual(icrsToHeliocentricParsecs({ raDeg: 0, decDeg: 0, distancePc: 2 }), { x: 2, y: 0, z: 0 });
});
test('ICRS north pole is mapped to Gobai scene +Y', () => {
  const p = icrsParsecsToScene(icrsToHeliocentricParsecs({ raDeg: 0, decDeg: 90, distancePc: 1 }));
  assert.ok(Math.abs(p.y - 100) < 1e-9); assert.ok(Math.abs(p.x) < 1e-9);
});
test('transforme les parsecs vers les unités scène avec origine', () => {
  assert.deepEqual(icrsParsecsToScene({ x: 1, y: 2, z: 3 }, { parsecToSceneUnits: 10, origin: { x: 1, y: 2, z: 3 } }), { x: 11, y: 32, z: -17 });
});
test('modèle de l’étoile exemple utilise une parallaxe et calcule sa position globale', () => {
  const model = buildInterstellarSystemModel(system());
  assert.equal(model.positionStatus, 'available'); assert.ok(model.distanceLightYears > 4.2 && model.distanceLightYears < 4.3);
  assert.ok(Number.isFinite(model.position.x));
});
test('refuse de fabriquer une position globale sans distance', () => {
  const item = system(); delete item.star.astrometry.parallaxMas; delete item.star.propagation;
  const model = buildInterstellarSystemModel(item);
  assert.equal(model.positionStatus, 'unavailable'); assert.equal(model.position, null);
});
test('renderer garde les systèmes dans un registre et refuse focus sans position', () => {
  class Group { constructor() { this.position = { x: 0, y: 0, z: 0, set(x,y,z){this.x=x;this.y=y;this.z=z;} }; this.userData = {}; this.children = []; this.visible = true; } add(x) { this.children.push(x); } remove(x) { this.children = this.children.filter((item) => item !== x); } traverse(fn) { fn(this); this.children.forEach(fn); } }
  class Vector3 { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;} }
  class Geometry { constructor(){} dispose(){} setAttribute(){} }
  class Material { constructor(options){Object.assign(this,options);} dispose(){} }
  class Mesh { constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(){}};this.scale={value:1,setScalar(v){this.value=v;}};this.userData={};} }
  class BufferAttribute { constructor(array,itemSize){this.array=array;this.itemSize=itemSize;} }
  const THREE = { Group, Vector3, Mesh, SphereGeometry: Geometry, MeshBasicMaterial: Material, BufferGeometry: Geometry, BufferAttribute, LineBasicMaterial: Material, Line: Mesh };
  const scene = { add(x){this.item=x;}, remove(){} };
  const renderer = new InterstellarSceneRenderer({ THREE, scene });
  const result = renderer.addSystem(system());
  assert.equal(result.model.positionStatus, 'available'); assert.equal(renderer.getSystem('etoile-exemple'), result);
  assert.equal(result.group.userData.globalMarker.visible, true);
  assert.equal(renderer.updateGlobalMarkers({ position: { x: 0, y: 0, z: 0 }, fov: 50 }, 900), 1);
  assert.ok(result.group.userData.globalMarker.scale.value >= 1);
  assert.equal(renderer.setSystemLOD('etoile-exemple', 'STAR'), true);
  assert.equal(result.group.userData.globalMarker.visible, true);
  assert.equal(renderer.setSystemLOD('etoile-exemple', 'PLANETS'), true);
  assert.equal(result.group.userData.globalMarker.visible, false);
  const focused = renderer.focusSystem('etoile-exemple');
  assert.deepEqual(focused.target, result.model.position);
  const epochUpdate = renderer.updateSystemEpoch('etoile-exemple', 2025);
  assert.equal(epochUpdate.ok, true);
  assert.equal(result.model.targetEpoch, 2025);
  assert.equal(renderer.setSystemLoaded('etoile-exemple', false), true);
  assert.equal(result.group.userData.loaded, false);
  assert.equal(renderer.setSystemLoaded('etoile-exemple', true), true);
  assert.equal(result.group.userData.loaded, true);
  assert.equal(renderer.removeSystem('etoile-exemple'), true);
});

test('renderer applique les niveaux LOD aux planètes et aux orbites', () => {
  const scene = { add() {}, remove() {} };
  const renderer = new InterstellarSceneRenderer({ THREE: { Vector3: class {} }, scene });
  const star = { userData: { gobaiKind: 'host-star' }, visible: true };
  const planet = { userData: { gobaiKind: 'exoplanet', positionAvailable: true }, visible: true };
  const orbit = { userData: { gobaiKind: 'exoplanet-orbit' }, visible: true };
  const localGroup = { traverse(callback) { [star, planet, orbit].forEach(callback); } };
  const group = { userData: { localGroup } };
  renderer.systems.set('sys', { group, model: { positionStatus: 'available' } });
  assert.equal(renderer.setSystemLOD('sys', 'STAR'), true);
  assert.equal(star.visible, false); assert.equal(planet.visible, false); assert.equal(orbit.visible, false);
  assert.equal(renderer.setSystemLOD('sys', 'PLANETS'), true);
  assert.equal(star.visible, true); assert.equal(planet.visible, true); assert.equal(orbit.visible, false);
  assert.equal(renderer.setSystemLOD('sys', 'DETAILED'), true);
  assert.equal(planet.visible, true); assert.equal(orbit.visible, true);
  assert.equal(renderer.setSystemLOD('sys', 'invalid'), false);
});

test('le modèle global propage les coordonnées à targetEpoch quand une astrométrie complète existe', () => {
  const item = system({ star: {
    id: 'gaia-dr3:5853498713190525696', name: 'Étoile exemple',
    coordinates: { frame: 'ICRS', epoch: 2000, raDeg: 217.4289422216058, decDeg: -62.67949018907555 },
    astrometry: { parallaxMas: 768.0665, properMotionRaMasYr: -3781.741, properMotionDecMasYr: 769.465, radialVelocityKmS: -20.578199 },
  } });
  const model = buildInterstellarSystemModel(item, { targetEpoch: 2026 });
  assert.equal(model.positionStatus, 'available');
  assert.equal(model.targetEpoch, 2026);
  assert.equal(model.astrometricState.method, 'space-motion-3d');
  assert.ok(model.distancePc < 1000 / 768.0665);
  assert.ok(model.astrometricState.totalSpaceVelocityKmS > 0);
});
