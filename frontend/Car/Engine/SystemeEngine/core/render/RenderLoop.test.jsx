import test from 'node:test';
import assert from 'node:assert/strict';
import { RenderLoop, DT_MAX_MS } from './RenderLoop.js';

// Fabrique un environnement de test : une boucle avec rAF/CAF/horloge injectés et pilotés à la main.
function setup() {
  // Rappels demandés : la pile des images en attente.
  const pending = [];
  // Horloge factice : instant courant, modifiable par le test.
  const clockRef = { now: 1000 };
  // Demande d'image factice : empile le rappel, renvoie un identifiant unique.
  const raf = (cb) => { pending.push(cb); return pending.length; };
  // Annulation factice : vide la pile.
  const caf = () => { pending.length = 0; };
  // Boucle de test.
  const loop = new RenderLoop({ raf, caf, clock: () => clockRef.now });
  return { loop, pending, clockRef };
}

test('register : exige une fonction update', () => {
  const { loop } = setup();
  assert.throws(() => loop.register('x', null), TypeError);
  assert.equal(loop.has('x'), false);
  loop.register('x', () => {});
  assert.equal(loop.has('x'), true);
  assert.equal(loop.unregister('x'), true);
  assert.equal(loop.unregister('x'), false);
});

test('start/stop : la boucle tourne puis s\'arrête, sans double démarrage', () => {
  const { loop, pending } = setup();
  assert.equal(loop.stop(), false);
  loop.start();
  assert.equal(loop.running, true);
  assert.equal(pending.length, 1);
  loop.start();
  assert.equal(pending.length, 1);
  assert.equal(loop.stop(), true);
  assert.equal(loop.running, false);
  assert.equal(loop.stop(), false);
});

test('tick : appelle chaque moteur dans l\'ordre d\'enregistrement, avec now et dt', () => {
  const { loop, pending } = setup();
  const calls = [];
  loop.register('a', (now, dt) => calls.push(['a', now, dt]));
  loop.register('b', (now, dt) => calls.push(['b', now, dt]));
  loop.start();
  pending.pop()(1000);
  assert.deepEqual(calls, [['a', 1000, 0], ['b', 1000, 0]]);
  pending.pop()(1033);
  assert.deepEqual(calls[2], ['a', 1033, 33]);
  assert.deepEqual(calls[3], ['b', 1033, 33]);
  loop.stop();
});

test('tick : dt borné à dtMaxMs (retour d\'onglet : pas de saut)', () => {
  const { loop, pending } = setup();
  const dts = [];
  loop.register('a', (now, dt) => dts.push(dt));
  loop.start();
  pending.pop()(0);
  pending.pop()(5000);
  assert.equal(dts[1], DT_MAX_MS);
  loop.stop();
});

test('tick : l\'erreur d\'un moteur n\'arrête pas les autres ni la boucle, sans rien écrire en console', () => {
  const { loop, pending } = setup();
  const errors = [];
  const origError = console.error;
  console.error = (...args) => errors.push(args[0]);
  loop.register('cassé', () => { throw new Error('boom'); });
  let called = false;
  loop.register('sain', () => { called = true; });
  loop.start();
  pending.pop()(1000);
  console.error = origError;
  assert.equal(called, true);
  assert.equal(errors.length, 0);
  assert.equal(pending.length, 1);
  loop.stop();
});

test('setHidden : la boucle se met en pause puis repart sans saut de temps', () => {
  const { loop, pending, clockRef } = setup();
  const dts = [];
  loop.register('a', (now, dt) => dts.push(dt));
  loop.start();
  pending.pop()(1000);
  loop.setHidden(true);
  assert.equal(loop.hidden, true);
  assert.equal(pending.length, 0);
  loop.setHidden(true);
  // L'horloge factice avance : le retour d'onglet repart de « maintenant ».
  clockRef.now = 9000;
  loop.setHidden(false);
  assert.equal(pending.length, 1);
  pending.pop()(9000);
  assert.equal(dts[dts.length - 1], 0);
  loop.stop();
});

test('stop : les moteurs restent enregistrés et un redémarrage les relance', () => {
  const { loop, pending } = setup();
  let calls = 0;
  loop.register('a', () => { calls += 1; });
  loop.start();
  pending.pop()(1000);
  loop.stop();
  loop.start();
  pending.pop()(2000);
  assert.equal(calls, 2);
  loop.stop();
});

test('singleton : l\'application exporte une boucle partagée', async () => {
  const mod = await import('./RenderLoop.js');
  assert.ok(mod.renderLoop instanceof RenderLoop);
  assert.equal(mod.renderLoop.running, false);
});
