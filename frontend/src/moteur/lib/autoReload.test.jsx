// Lanceur de tests de Node.
import test from 'node:test';
// Vérifications strictes de Node.
import assert from 'node:assert/strict';
// Ce qui est testé.
import { buildChanged, buildOf, watchBuild } from './autoReload';

// Fausses minuteries : l'attente se termine tout de suite.
const timers = { setInterval: () => 1, clearInterval: () => {}, setTimeout: (fn) => { fn(); return 1; }, clearTimeout: () => {} };

// Premier test : la lecture et la comparaison.
test('version du serveur : lecture de /health et comparaison', () => {
  // La version est lue sans ses espaces.
  assert.equal(buildOf({ build: ' abc ' }), 'abc');
  // Sans champ : texte vide.
  assert.equal(buildOf({}), '');
  // Sans réponse : texte vide.
  assert.equal(buildOf(null), '');
  // Deux versions différentes : changée.
  assert.equal(buildChanged('a', 'b'), true);
  // Deux fois la même : pas changée.
  assert.equal(buildChanged('a', 'a'), false);
  // Première inconnue : pas changée.
  assert.equal(buildChanged('', 'b'), false);
  // Seconde inconnue : pas changée.
  assert.equal(buildChanged('a', ''), false);
// Fin du test.
});

// Deuxième test : le rechargement.
test('rechargement : seulement quand une nouvelle version est confirmée', async () => {
  // Versions que le faux serveur donne tour à tour.
  const answers = ['a', 'a', 'b', 'b'];
  // Nombre de rechargements.
  let reloads = 0;
  // Lance la surveillance.
  const w = watchBuild({ fetchBuild: async () => answers.shift(), reload: () => { reloads++; }, timers, visible: () => true });
  // Laisse passer la première lecture.
  await new Promise((r) => setImmediate(r)); // première lecture : version d'ouverture
  // Deuxième vérification : même version.
  await w.check();
  // Aucun rechargement.
  assert.equal(reloads, 0);
  // Troisième vérification : nouvelle version, confirmée.
  await w.check(); // « b » lue puis confirmée
  // Un rechargement.
  assert.equal(reloads, 1);
  // Quatrième vérification : la surveillance est arrêtée.
  await w.check(); // arrêté après le rechargement
  // Toujours un seul rechargement.
  assert.equal(reloads, 1);
// Fin du test.
});

// Troisième test : les cas sans rechargement.
test('rechargement : pas de version, panne ou version non confirmée → rien', async () => {
  // Nombre de rechargements.
  let reloads = 0;
  // Fonction qui les compte.
  const reload = () => { reloads++; };
  // Surveillance sans version.
  const none = watchBuild({ fetchBuild: async () => '', reload, timers, visible: () => true });
  // Laisse passer la première lecture.
  await new Promise((r) => setImmediate(r));
  // Une vérification.
  await none.check();
  // Versions qui changent puis reviennent, puis une panne.
  const answers = ['a', 'b', 'a', null];
  // Surveillance avec ces réponses.
  const flip = watchBuild({ fetchBuild: async () => { const v = answers.shift(); if (v === null) throw new Error('réseau'); return v; }, reload, timers, visible: () => true });
  // Laisse passer la première lecture.
  await new Promise((r) => setImmediate(r));
  // Nouvelle version non confirmée.
  await flip.check(); // « b » puis « a » : non confirmée
  // Panne.
  await flip.check(); // panne
  // Surveillance d'une page cachée.
  const hidden = watchBuild({ fetchBuild: async () => { throw new Error('ne doit pas être lue'); }, reload, timers, visible: () => false });
  // Une vérification : rien n'est lu.
  await hidden.check();
  // Aucun rechargement.
  assert.equal(reloads, 0);
// Fin du test.
});
