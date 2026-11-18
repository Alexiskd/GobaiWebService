import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderDiagnosticsPolicy } from './RenderDiagnosticsPolicy.js';

test('diagnostics starts unknown and accepts normal renderer counters', () => {
  const policy = new RenderDiagnosticsPolicy();
  assert.equal(policy.snapshot().level, 'unknown');
  const result = policy.analyze({ calls: 80, triangles: 400_000, textures: 32, geometries: 200 });
  assert.equal(result.level, 'normal');
  assert.equal(result.warnings.length, 0);
});

test('diagnostics flags warning and critical thresholds', () => {
  const policy = new RenderDiagnosticsPolicy();
  const result = policy.analyze({ calls: 300, triangles: 3_500_000, textures: 140, geometries: 2_100 });
  assert.equal(result.level, 'critical');
  assert.equal(result.pressure.calls.level, 'warning');
  assert.equal(result.pressure.triangles.level, 'critical');
  assert.equal(result.recommendations.length, 4);
});

test('invalid counters remain unknown instead of becoming false warnings', () => {
  const policy = new RenderDiagnosticsPolicy();
  const result = policy.analyze({ calls: NaN, triangles: -1, textures: null, geometries: undefined });
  assert.equal(result.level, 'normal');
  assert.equal(result.pressure.calls.level, 'unknown');
  assert.equal(result.warnings.length, 0);
});

test('snapshot is detached and reset clears diagnostics', () => {
  const policy = new RenderDiagnosticsPolicy();
  const snapshot = policy.analyze({ calls: 600, triangles: 10, textures: 1, geometries: 1 });
  snapshot.warnings.length = 0;
  assert.equal(policy.snapshot().warnings.length, 1);
  policy.reset();
  assert.equal(policy.snapshot().level, 'unknown');
});
