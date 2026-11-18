import test from 'node:test';
import assert from 'node:assert/strict';
import { isSatelliteVisibleInPerivolume } from './satellitePerivolume.js';

test('affiche un satellite quand le périvolume de sa planète est actif', () => {
  const earth = { id: 'earth' };
  assert.equal(isSatelliteVisibleInPerivolume(earth, earth), true);
});

test('masque le satellite lorsque le périvolume actif appartient à une autre planète', () => {
  assert.equal(isSatelliteVisibleInPerivolume({ id: 'mars' }, { id: 'earth' }), false);
});

test('masque le satellite hors périvolume ou lorsqu’il est décoché', () => {
  const mars = { id: 'mars' };
  assert.equal(isSatelliteVisibleInPerivolume(mars, null), false);
  assert.equal(isSatelliteVisibleInPerivolume(mars, mars, true), false);
});
