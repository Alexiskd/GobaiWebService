import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresAstronomicalRepository } from './PostgresAstronomicalRepository.js';

function fakePool({ failAt = null } = {}) {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (failAt && sql === failAt) throw new Error('simulated database failure');
      if (sql.includes('INSERT INTO astronomical_stars')) return { rows: [{ id: 7 }], rowCount: 1 };
      if (sql.includes('INSERT INTO exoplanets')) return { rows: [{ id: 9 }], rowCount: 1 };
      if (sql.includes('INSERT INTO astronomical_source_records')) return { rows: [{ id: 3, provider: values[0], external_id: values[1], object_kind: values[2] }], rowCount: 1 };
      return { rows: [{ id: 1, status: 'succeeded', finished_at: 'now', object_key: 'gaia:1', epoch_jd: 1, frame: 'ICRS' }], rowCount: 1 };
    },
    release() { calls.push({ sql: 'RELEASE' }); },
  };
  return { calls, async connect() { return client; }, async query(sql, values) { return client.query(sql, values); } };
}

const system = { id: 's1', kind: 'star-system', star: { id: 'g1', name: 'Star', canonicalIdentifier: { catalog: 'Gaia DR3', value: '123' }, coordinates: {}, astrometry: {} }, planets: [] };

test('persiste un système dans une transaction atomique', async () => {
  const pool = fakePool();
  const repository = new PostgresAstronomicalRepository({ pool });
  const result = await repository.saveStarSystem(system);
  assert.equal(result.star.id, 7);
  assert.ok(pool.calls.some((call) => call.sql === 'BEGIN'));
  assert.ok(pool.calls.some((call) => call.sql === 'COMMIT'));
  assert.equal(pool.calls.at(-1).sql, 'RELEASE');
});

test('annule la transaction en cas d’erreur', async () => {
  const pool = fakePool({ failAt: 'COMMIT' });
  const repository = new PostgresAstronomicalRepository({ pool });
  await assert.rejects(repository.saveStarSystem(system), /simulated database failure/);
  assert.ok(pool.calls.some((call) => call.sql === 'ROLLBACK'));
});

test('enregistre un échantillon de position', async () => {
  const pool = fakePool();
  const repository = new PostgresAstronomicalRepository({ pool });
  const result = await repository.savePositionSample({ objectKey: 'gaia:1', epochJulianDate: 1, frame: 'ICRS', position: { x: 1, y: 2, z: 3 } });
  assert.equal(result.object_key, 'gaia:1');
});

test('enregistre le début et la fin d’une synchronisation', async () => {
  const pool = fakePool();
  const repository = new PostgresAstronomicalRepository({ pool });
  const started = await repository.startSyncRun({ provider: 'gaia', dataset: 'gaia_source' });
  assert.equal(started.id, 1);
  const finished = await repository.finishSyncRun(1, { status: 'succeeded', rowsReceived: 10 });
  assert.equal(finished.status, 'succeeded');
  await assert.rejects(repository.finishSyncRun(1, { status: 'running' }), /Statut final/);
});


test('conserve un enregistrement source avec fournisseur et provenance', async () => {
  const pool = fakePool();
  const repository = new PostgresAstronomicalRepository({ pool });
  const result = await repository.saveSourceRecord({ provider: 'gaia', externalId: '123', objectKind: 'star', payload: { source_id: '123' } });
  assert.equal(result.provider, 'gaia');
  assert.ok(pool.calls.some((call) => call.sql.includes('astronomical_source_records')));
  await assert.rejects(repository.saveSourceRecord({ provider: 'unknown', externalId: '1', objectKind: 'star', payload: {} }), /Fournisseur/);
});
