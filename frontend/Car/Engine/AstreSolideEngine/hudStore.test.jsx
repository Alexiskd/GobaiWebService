// Tests du magasin du HUD : une republication identique ne réveille personne et garde les références.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHudStore, sameValue } from './hudStoreCore.js';

test('même contenu : pas de notification, ancienne référence gardée', () => {
  const store = createHudStore({ gps: { lat: 1, lon: 2, corners: [[0, 0], [1, 1]] }, date: 'a' });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  const before = store.get();
  store.set({ gps: { lat: 1, lon: 2, corners: [[0, 0], [1, 1]] }, date: 'a' });
  assert.equal(calls, 0);
  assert.equal(store.get(), before);
  store.set({ date: 'b' });
  assert.equal(calls, 1);
  assert.equal(store.get().gps, before.gps);
  assert.equal(store.get().date, 'b');
});

test('contenu différent, ou même objet modifié sur place : notification', () => {
  const progress = { done: 1 };
  const store = createHudStore({ gps: { lat: 1 }, progress });
  let calls = 0;
  store.subscribe(() => { calls += 1; });
  store.set({ gps: { lat: 2 } });
  assert.equal(calls, 1);
  progress.done = 2;
  store.set({ progress });
  assert.equal(calls, 2);
});

test('sameValue : tableaux, objets simples, profondeur bornée', () => {
  assert.ok(sameValue({ a: [1, 2] }, { a: [1, 2] }));
  assert.ok(!sameValue({ a: [1, 2] }, { a: [1, 3] }));
  assert.ok(!sameValue({ a: 1 }, { a: 1, b: undefined }));
  assert.ok(sameValue(NaN, NaN));
  assert.ok(!sameValue(new Date(0), new Date(0)));
});
