import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExoplanetSceneModel, orbitalReferenceToScene, sampleOrbit } from './ExoplanetSceneEngine.js';

const system = (overrides = {}) => ({
  id: 'gaia:123', kind: 'star-system', identityStatus: 'verified-gaia-identity',
  star: { id: 'gaia:123', name: 'Example Star' }, targetJulianDate: 2451545,
  planets: [{ id: 'planet:b', name: 'Example b', orbit: { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0.2, inclinationDeg: 30, longitudeAscendingNodeDeg: 40, argumentOfPeriastronDeg: 50 }, orbitalState: { status: 'calculated', position: { position: { x: 0.1, y: 0.2, z: 0.3 } }, warnings: [] }, physical: { radiusEarth: 2 } }],
  ...overrides,
});

test('convertit les axes orbitaux vers le repère de scène Gobai sans prétendre convertir en ICRS', () => {
  assert.deepEqual(orbitalReferenceToScene({ x: 1, y: 2, z: 3 }), { x: 1, y: 3, z: -2 });
});

test('construit le modèle de scène avec position en unités de scène', () => {
  const model = buildExoplanetSceneModel(system(), { auToSceneUnits: 10 });
  assert.equal(model.kind, 'exoplanet-scene-model');
  assert.deepEqual(model.planets[0].position, { x: 1, y: 3, z: -2 });
  assert.equal(model.statistics.drawableOrbits, 1);
  assert.match(model.frame, /not ICRS/);
});

test('calcule une position lorsque la phase orbitale est fournie mais aucun état précalculé', () => {
  const data = system();
  data.planets[0].orbitalState = { status: 'not-requested' };
  data.planets[0].orbit = { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0, meanAnomalyAtEpochDeg: 0, epochJulianDate: 2451545 };
  const model = buildExoplanetSceneModel(data, { auToSceneUnits: 1 });
  assert.equal(model.planets[0].positionStatus, 'available');
  assert.ok(Number.isFinite(model.planets[0].position.x));
});

test('ne fabrique pas une position si les paramètres de phase sont absents', () => {
  const data = system();
  data.planets[0].orbitalState = { status: 'not-requested' };
  data.planets[0].orbit = { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0 };
  const model = buildExoplanetSceneModel(data);
  assert.equal(model.planets[0].positionStatus, 'unavailable');
  assert.equal(model.statistics.unavailablePositions, 1);
});

test('échantillonne une ellipse fermée dans le repère scène', () => {
  const points = sampleOrbit({ semiMajorAxisAu: 2, eccentricity: 0.25, inclinationDeg: 0, longitudeAscendingNodeDeg: 0, argumentOfPeriastronDeg: 0 }, 64, 5);
  assert.equal(points.length, 65 * 3);
  assert.ok(Math.abs(points[0] - points[192]) < 1e-5);
  assert.ok(Math.abs(points[1] - points[193]) < 1e-5);
  assert.ok(Math.abs(points[2] - points[194]) < 1e-5);
});

test('borne le nombre de segments et refuse un système invalide', () => {
  assert.throws(() => buildExoplanetSceneModel({ kind: 'star-system' }), /système stellaire normalisé/);
  assert.throws(() => sampleOrbit({ semiMajorAxisAu: 1, eccentricity: 0.1 }, 2), /segments/);
  assert.throws(() => sampleOrbit({ semiMajorAxisAu: 1, eccentricity: 1 }, 64), /ellipse/);
});

test('construit un groupe Three.js avec étoile, planète, orbite et mise à jour', async () => {
  const { createExoplanetSystemGroup } = await import('./ExoplanetSceneEngine.js');
  class Group {
    constructor() { this.children = []; this.userData = {}; }
    add(child) { this.children.push(child); }
    traverse(callback) { this.children.forEach(callback); }
  }
  class Geometry {
    constructor() { this.attributes = {}; this.disposed = false; }
    setAttribute(key, value) { this.attributes[key] = value; }
    dispose() { this.disposed = true; }
  }
  class Material { constructor(options) { this.options = options; } dispose() { this.disposed = true; } }
  class Mesh { constructor(geometry, material) { this.geometry = geometry; this.material = material; this.position = { set: (x, y, z) => { this.position.value = { x, y, z }; } }; this.userData = {}; } }
  class Line extends Mesh {}
  class BufferAttribute { constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; } }
  const THREE = { Group, Mesh, SphereGeometry: Geometry, MeshBasicMaterial: Material, BufferGeometry: Geometry, BufferAttribute, Line, LineBasicMaterial: Material };
  const model = buildExoplanetSceneModel(system());
  const group = createExoplanetSystemGroup(THREE, model);
  assert.equal(group.children.length, 3);
  const planetMesh = group.children.find((item) => item.userData.gobaiKind === 'exoplanet');
  assert.equal(planetMesh.visible, true);
  const next = buildExoplanetSceneModel(system({ planets: [{ ...system().planets[0], orbitalState: { status: 'not-requested' }, orbit: { periodDays: 10, semiMajorAxisAu: 0.1, eccentricity: 0, meanAnomalyAtEpochDeg: 90, epochJulianDate: 2451545 } }] }));
  group.userData.updateFromModel(next);
  assert.equal(planetMesh.visible, true);
  assert.ok(planetMesh.position.value);
  group.userData.dispose();
});
