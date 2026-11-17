import test from 'node:test';
import assert from 'node:assert/strict';
import { assessInstancingFamily, buildInstancingReport, INSTANCING_REASONS } from './InstancingEligibility.js';

const geometry = {};
const material = {};
const item = (extra = {}) => ({ geometry, material, ...extra });

test('famille homogène éligible à l’instancing', () => {
  assert.deepEqual(assessInstancingFamily([item(), item()]), {
    eligible: true, count: 2, reason: INSTANCING_REASONS.READY,
  });
});

test('refuse les géométries différentes', () => {
  assert.equal(assessInstancingFamily([item(), item({ geometry: {} })]).reason, INSTANCING_REASONS.NO_SHARED_GEOMETRY);
});

test('refuse les matériaux différents', () => {
  assert.equal(assessInstancingFamily([item(), item({ material: {} })]).reason, INSTANCING_REASONS.NO_SHARED_MATERIAL);
});

test('préserve le picking individualisé', () => {
  assert.equal(assessInstancingFamily([item(), item({ perObjectRaycast: true })]).reason, INSTANCING_REASONS.PER_OBJECT_RAYCAST);
});

test('préserve la visibilité indépendante', () => {
  assert.equal(assessInstancingFamily([item({ perObjectVisibility: true })]).reason, INSTANCING_REASONS.PER_OBJECT_VISIBILITY);
});

test('exclut les objets DOM', () => {
  assert.equal(assessInstancingFamily([{ kind: 'dom' }]).reason, INSTANCING_REASONS.DOM_ELEMENT);
});

test('produit un rapport stable par famille', () => {
  const report = buildInstancingReport([{ id: 'ready', items: [item(), item()] }, { id: 'pick', items: [item({ perObjectRaycast: true })] }]);
  assert.equal(report.length, 2);
  assert.equal(report[0].eligible, true);
  assert.equal(report[1].reason, INSTANCING_REASONS.PER_OBJECT_RAYCAST);
});
