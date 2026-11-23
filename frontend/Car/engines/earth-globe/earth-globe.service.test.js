// Tests du service earth-globe (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { globeProfile, reliefCapKm, reliefShown, usesHexCells, withGlobeProfile } from './earth-globe.service.js';

test('la Terre prend la méthode Earth Maps : arbre de tuiles, relief partout, allumé par défaut', () => {
  const earth = withGlobeProfile({ id: 'earth', radiusKm: 6371 });
  assert.equal(earth.display, 'quadtree');
  assert.equal(earth.reliefMaxKm, Infinity);
  assert.equal(earth.reliefDefaultOn, true);
  assert.equal(earth.radiusKm, 6371);
  assert.equal(usesHexCells(earth), false);
});

test('les autres astres gardent les cellules hexagonales et leurs réglages', () => {
  const moon = withGlobeProfile({ id: 'moon', radiusKm: 1737.4 });
  assert.equal(moon.display, 'hex');
  assert.equal('reliefMaxKm' in moon, false);
  assert.equal('reliefDefaultOn' in moon, false);
  assert.equal(usesHexCells(moon), true);
  assert.equal(globeProfile('mars').method, 'hex');
});

test('plafond du relief : celui du profil, sinon celui d\'avant', () => {
  assert.equal(reliefCapKm({ reliefMaxKm: Infinity }, 1), Infinity);
  assert.equal(reliefCapKm({ reliefMaxKm: 5 }, 1), 5);
  assert.equal(reliefCapKm({}, 1), 1);
  assert.equal(reliefCapKm(undefined, Infinity), Infinity);
});

test('relief affiché : choix gardé, sinon défaut du profil', () => {
  assert.equal(reliefShown(null, true), true);
  assert.equal(reliefShown('', false), false);
  assert.equal(reliefShown('0', true), false);
  assert.equal(reliefShown('1.5', false), true);
  assert.equal(reliefShown('abc', true), true);
});
