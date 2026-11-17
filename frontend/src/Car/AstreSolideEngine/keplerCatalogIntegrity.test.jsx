import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASTRES, MOON_KEPLER } from '../SystemeEngine/data/astronomy/data/kepler-elements.ts';
import { ALL_SATELLITES } from '../SystemeEngine/data/astronomy/data/bodies.data';
import { toEcliptic } from '../SystemeEngine/data/astronomy/ephemeris/kepler-orbits.ts';

test('les 34 satellites de la vue physique ont une seule entrée orbitale canonique', () => {
  const ids = ALL_SATELLITES.map((body) => body.id);
  const orbitalIds = new Set(ASTRES.map((body) => body.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 34);
  assert.ok(ids.every((id) => orbitalIds.has(id)));
  assert.equal(new Set([...ASTRES, MOON_KEPLER].map((body) => body.id)).size, ASTRES.length + 1);
});

test('les paramètres anormaux de Pluton, Puck et Protée sont remplacés par les éléments JPL', () => {
  const byId = new Map(ASTRES.map((body) => [body.id, body]));
  assert.deepEqual([byId.get('nix').kepler.a, byId.get('nix').kepler.e], [49300, 0.015]);
  assert.deepEqual([byId.get('hydra').kepler.a, byId.get('hydra').kepler.e], [65200, 0.009]);
  assert.deepEqual([byId.get('kerberos').kepler.a, byId.get('kerberos').kepler.e], [58300, 0.010]);
  assert.deepEqual([byId.get('puck').kepler.a, byId.get('puck').kepler.e], [86004, 0]);
  assert.deepEqual([byId.get('proteus').kepler.a, byId.get('proteus').kepler.e], [117700, 0.001]);
});

test('la conversion Laplace utilise le pôle ICRF fourni par JPL', () => {
  const phobos = ASTRES.find((body) => body.id === 'phobos');
  assert.deepEqual(phobos.kepler.referencePoleIcrf, [317.7, 52.9]);
  const result = toEcliptic([0, 0, 1], phobos);
  assert.equal(result.length, 3);
  assert.ok(result.every(Number.isFinite));
  assert.notDeepEqual(result, [0, 0, 1]);
});
