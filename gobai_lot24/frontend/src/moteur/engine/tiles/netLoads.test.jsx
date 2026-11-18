// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe les éléments testés.
import { AdaptiveTimeout, HostGate, NET_STATS, SharedLoads, hostOf } from './netLoads';

// Téléchargement factice : se résout quand on le demande, et note son annulation.
function fakeLoader() {
  // Téléchargements lancés.
  const calls = [];
  // La fonction de téléchargement.
  const load = (url, signal) => new Promise((resolve, reject) => {
    // Entrée notée.
    const c = { url, signal, resolve, aborted: false };
    // Annulation : notée et rejetée.
    signal.addEventListener('abort', () => { c.aborted = true; reject(Object.assign(new Error('annulé'), { name: 'AbortError' })); });
    // Range l'entrée.
    calls.push(c);
  });
  // Renvoie les deux.
  return { calls, load };
}

// Annulation réelle : le téléchargement n'est annulé que quand plus personne n'attend l'image.
test('SharedLoads : un téléchargement par adresse, annulé quand plus personne n\'attend', async () => {
  // Chargeur factice et partage.
  const { calls, load } = fakeLoader(), shared = new SharedLoads(load, { setTimer: () => {} });
  // Deux tuiles demandent la même image.
  const a = new AbortController(), b = new AbortController();
  // Promesses des deux appelants.
  const pa = shared.get('u', a.signal), pb = shared.get('u', b.signal);
  // Un seul téléchargement.
  assert.equal(calls.length, 1);
  // La première abandonne : le téléchargement continue pour la seconde.
  a.abort(); await assert.rejects(pa, { name: 'AbortError' }); assert.equal(calls[0].aborted, false);
  // La seconde abandonne aussi : le téléchargement est annulé, et compté.
  const before = NET_STATS.aborted; b.abort(); await assert.rejects(pb, { name: 'AbortError' });
  // Annulé.
  assert.equal(calls[0].aborted, true); assert.equal(NET_STATS.aborted, before + 1);
  // Une nouvelle demande relance un téléchargement.
  const c = new AbortController(), pc = shared.get('u', c.signal); assert.equal(calls.length, 2);
  // Il réussit : l'appelant reçoit l'image.
  calls[1].resolve('img'); assert.equal(await pc, 'img');
  // Un appelant sans signal attend jusqu'au bout : jamais annulé.
  const d = new AbortController(); const pd = shared.get('v', d.signal); const pe = shared.get('v');
  // Le premier abandonne : le téléchargement reste.
  d.abort(); await assert.rejects(pd, { name: 'AbortError' }); assert.equal(calls[2].aborted, false);
  // Et sert le second.
  calls[2].resolve('img2'); assert.equal(await pe, 'img2');
});

// Délai adaptatif : départ 4 s, puis moyenne + 4 écarts, borné entre 1,5 et 8 s.
test('AdaptiveTimeout : délai mesuré sur les temps de réponse', () => {
  // Délai de départ.
  const t = new AdaptiveTimeout({ initial: 4000, min: 1500, max: 8000 });
  // Source jamais mesurée : 4 s.
  assert.equal(t.timeoutFor('ign'), 4000);
  // Réponses régulières de 200 ms : le délai descend au minimum.
  for (let i = 0; i < 40; i++) t.record('ign', 200);
  // 1,5 s.
  assert.equal(t.timeoutFor('ign'), 1500);
  // Réponses lentes et irrégulières : le délai monte, borné à 8 s.
  for (let i = 0; i < 40; i++) t.record('lent', i % 2 ? 900 : 4000);
  // Entre 4 et 8 s.
  assert.ok(t.timeoutFor('lent') > 4000 && t.timeoutFor('lent') <= 8000);
});

// Limite par serveur : file d'attente, montée après des réponses rapides, division par deux après une panne.
test('HostGate : places par serveur, montée et descente', async () => {
  // Deux places au départ.
  const gate = new HostGate({ initial: 2, min: 1, max: 4, fastMs: 100, streak: 2 });
  // Tâches en attente de fin.
  const ends = [];
  // Une tâche qui finit quand on le demande.
  const task = () => new Promise((resolve) => ends.push(resolve));
  // Trois tâches pour le même serveur : deux partent, une attend.
  const ps = [gate.run('a', task), gate.run('a', task), gate.run('a', task)];
  // Laisse partir ce qui peut l'être.
  await Promise.resolve(); await Promise.resolve();
  // Deux en cours.
  assert.equal(ends.length, 2);
  // Une finit : la troisième part.
  ends[0]('ok'); await ps[0]; await new Promise((r) => setTimeout(r, 0));
  // Trois lancées.
  assert.equal(ends.length, 3);
  // Deux réponses rapides : une place de plus.
  gate.success('a', 20); gate.success('a', 20); assert.equal(gate.limits().a, 3);
  // Panne : moitié des places.
  gate.failure('a'); assert.equal(gate.limits().a, 1);
  // Annulée pendant l'attente : rejet, rien de lancé.
  const ctrl = new AbortController(); const pw = gate.run('b', task, ctrl.signal); const pz = gate.run('b', task); const pq = gate.run('b', task, ctrl.signal);
  // La troisième attend ; annulée.
  ctrl.abort(); await assert.rejects(pq, { name: 'AbortError' });
  // Fin des tâches restantes.
  ends.forEach((e) => e('ok')); void pw; void pz;
  // Serveur d'une adresse.
  assert.deepEqual([hostOf('https://data.geopf.fr/wmts?x=1'), hostOf('/api/v1/tiles/1/2/3'), hostOf(42)], ['data.geopf.fr', 'local', 'local']);
});
