import test from 'node:test';
import assert from 'node:assert/strict';
import { createProximaCentauriIllustrativeSystem } from './ProximaCentauriIllustrativeSystem.js';
import { buildExoplanetSceneModel } from '../../../engine/exoplanets/ExoplanetSceneEngine.js';

test('le système Proxima embarqué existe sans réseau et possède une étoile identifiée', () => {
  const system = createProximaCentauriIllustrativeSystem();
  assert.equal(system.kind, 'star-system');
  assert.equal(system.star.name, 'Proxima Centauri');
  assert.ok(system.star.astrometry.parallaxMas > 0);
  assert.equal(system.planets.length, 1);
});

test('la planète Proxima b possède une orbite lisible explicitement schématique', () => {
  const system = createProximaCentauriIllustrativeSystem();
  const planet = system.planets[0];
  assert.equal(planet.name, 'Proxima Centauri b');
  assert.ok(planet.orbit.semiMajorAxisAu > 0);
  assert.ok(planet.orbit.periodDays > 0);
  assert.equal(system.representation.mode, 'schematic');
  assert.match(system.representation.note, /schématique/);
});

test('le modèle lisible reconstruit une étoile, une planète et une orbite sans réseau', () => {
  const system = createProximaCentauriIllustrativeSystem();
  const model = buildExoplanetSceneModel(system, { scaleMode: 'readable', auToSceneUnits: 23455, targetJulianDate: 2461000 });
  assert.equal(model.scaleMode, 'readable');
  assert.equal(model.planets.length, 1);
  assert.equal(model.planets[0].positionStatus, 'available');
  assert.ok(model.planets[0].orbit.points.length > 0);
  assert.match(model.warnings?.join(' ') || system.representation.note, /schématique|schématique/);
});
