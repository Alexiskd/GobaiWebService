// Tests des sources d'imagerie du globe CesiumJS (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { CESIUM_IMAGERY, imageryCredits } from './cesium-earth.sources.js';

test('trois couches ouvertes, sans clé, de la plus large à la plus fine', () => {
  assert.deepEqual(CESIUM_IMAGERY.map((l) => l.id), ['gibs', 'sentinel2', 'ign']);
  for (const l of CESIUM_IMAGERY) {
    assert.match(l.url, /\{z\}/); assert.match(l.url, /\{x\}/); assert.match(l.url, /\{y\}/);
    assert.doesNotMatch(l.url, /key=|token=|apikey/i);
  }
});

test('mentions sans doublon', () => {
  assert.equal(imageryCredits().split(' · ').length, 3);
});
