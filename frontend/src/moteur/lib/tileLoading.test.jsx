// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { IDLE, tileLoadStep } from './tileLoading';

// snap : fabrique un état de tuiles prêt, modifié par les champs donnés.
const snap = (over) => ({ layerId: 'fond', status: 'loading', loading: 0, preload: { done: 0, total: 0 }, ...over });

// Premier test : sans fond, en erreur ou sans rien à charger, l'indicateur est au repos.
test('tuiles : au repos sans fond, en erreur ou quand rien ne charge', () => {
  // Sans état.
  assert.equal(tileLoadStep(IDLE, null), IDLE);
  // Sans fond affiché.
  assert.equal(tileLoadStep(IDLE, snap({ layerId: null, loading: 4 })), IDLE);
  // En erreur.
  assert.equal(tileLoadStep(IDLE, snap({ status: 'error', loading: 4 })), IDLE);
  // Prêt, rien en file.
  assert.equal(tileLoadStep(IDLE, snap({ status: 'ready' })), IDLE);
// Fin du test.
});

// Deuxième test : l'avancement suit la part du pic déjà arrivée.
test('tuiles : le pourcentage est la part du pic déjà chargée', () => {
  // 20 images attendues : début à 0 %.
  let s = tileLoadStep(IDLE, snap({ loading: 20 }));
  // Vérifie l'état.
  assert.deepEqual(s, { busy: true, peak: 20, percent: 0 });
  // Il en reste 5 : 75 %.
  s = tileLoadStep(s, snap({ loading: 5 }));
  // Vérifie le pourcentage.
  assert.equal(s.percent, 75);
  // Plus rien : repos.
  assert.equal(tileLoadStep(s, snap({ status: 'ready', loading: 0 })), IDLE);
// Fin du test.
});

// Troisième test : de nouvelles tuiles en file ne font pas reculer la barre.
test('tuiles : la barre ne recule jamais pendant un même chargement', () => {
  // 10 attendues, puis 2 : 80 %.
  let s = tileLoadStep(tileLoadStep(IDLE, snap({ loading: 10 })), snap({ loading: 2 }));
  // Vérifie.
  assert.equal(s.percent, 80);
  // Un déplacement en ajoute 30 : le pic monte, le pourcentage reste.
  s = tileLoadStep(s, snap({ loading: 30 }));
  // Vérifie le pic et le pourcentage.
  assert.deepEqual(s, { busy: true, peak: 30, percent: 80 });
  // Jamais 100 % tant qu'il en reste une.
  assert.ok(tileLoadStep(s, snap({ loading: 1 })).percent <= 99);
// Fin du test.
});

// Quatrième test : pendant un préchargement, le décompte du moteur fait foi.
test('tuiles : le préchargement suit le décompte fait / total', () => {
  // 30 sur 120 : 25 %.
  const s = tileLoadStep(IDLE, snap({ status: 'ready', preload: { done: 30, total: 120 } }));
  // Vérifie.
  assert.deepEqual(s, { busy: true, peak: 0, percent: 25 });
  // Préchargement fini et rien en file : repos.
  assert.equal(tileLoadStep(s, snap({ status: 'ready', preload: { done: 120, total: 120 } })), IDLE);
// Fin du test.
});
