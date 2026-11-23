// File de chargement en tas binaire (tileLoader.jsx). Lancer : npm test.
// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe TileLoader, la file de chargement, depuis tileLoader.
import { TileLoader } from './tileLoader.jsx';

/** File arrêtée : aucun chargement ne démarre (concurrence 0), on lit l'ordre de sortie à la main. */
// drain : vide la file dans l'ordre où elle démarrerait les chargements (début).
function drain(loader) {
  // Ordre de sortie.
  const out = [];
  // Tant qu'il reste des demandes : la tête du tas sort.
  while (loader.queued) out.push(loader.removeAt(0).key);
  // Renvoie l'ordre.
  return out;
// Fin de drain.
}

// Test : ordre de sortie identique à un tri stable.
test('file : plus petite priorité d\'abord, la plus ancienne à priorité égale, même après mises à jour et annulations', () => {
  // Générateur pseudo-aléatoire reproductible.
  let seed = 7;
  // rnd : nombre entre 0 et 1.
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // File arrêtée.
  const loader = new TileLoader(0);
  // Référence : priorités attendues, par clé, et ordre d'arrivée.
  const ref = new Map();
  // 300 demandes, priorités entières de 0 à 19 (beaucoup d'égalités).
  for (let i = 0; i < 300; i++) { const p = Math.floor(rnd() * 20); loader.load(`k${i}`, p, () => null).catch(() => {}); ref.set(`k${i}`, { p, i }); }
  // 60 demandes remontées (priorité plus petite) ou redemandées avec une plus grande (sans effet).
  for (let n = 0; n < 60; n++) { const k = `k${Math.floor(rnd() * 300)}`; const p = Math.floor(rnd() * 20); loader.load(k, p, () => null); const r = ref.get(k); r.p = Math.min(r.p, p); }
  // 50 annulations.
  for (let n = 0; n < 50; n++) { const k = `k${Math.floor(rnd() * 300)}`; loader.cancel(k); ref.delete(k); }
  // Ordre attendu : tri stable par priorité puis ordre d'arrivée.
  const expected = [...ref.entries()].sort((a, b) => a[1].p - b[1].p || a[1].i - b[1].i).map(([k]) => k);
  // Même ordre de sortie.
  assert.deepEqual(drain(loader), expected);
// Fin du test.
});

// Test : reprioritize reconstruit le tas.
test('file : reprioritize reclasse toute la file', () => {
  // File arrêtée.
  const loader = new TileLoader(0);
  // Cinq demandes, a en tête.
  for (const [k, p] of [['a', 1], ['b', 2], ['c', 3], ['d', 4], ['e', 5]]) loader.load(k, p, () => null);
  // Priorités inversées.
  loader.reprioritize((key, p) => 10 - p);
  // e d'abord, a en dernier.
  assert.deepEqual(drain(loader), ['e', 'd', 'c', 'b', 'a']);
// Fin du test.
});

// Test : la file démarre bien la meilleure demande.
test('file : un seul chargement à la fois, toujours le plus prioritaire', async () => {
  // Une place.
  const loader = new TileLoader(1);
  // Ordre de démarrage.
  const started = [];
  // run : note le démarrage puis rend la main.
  const run = (k) => async () => { started.push(k); await null; return k; };
  // a démarre tout de suite ; c, b et d attendent.
  const all = [loader.load('a', 9, run('a')), loader.load('c', 3, run('c')), loader.load('b', 1, run('b')), loader.load('d', 3, run('d'))];
  // Attend la fin de tout.
  await Promise.all(all);
  // a (déjà parti), puis b, puis c (plus ancienne que d à priorité égale), puis d.
  assert.deepEqual(started, ['a', 'b', 'c', 'd']);
// Fin du test.
});
