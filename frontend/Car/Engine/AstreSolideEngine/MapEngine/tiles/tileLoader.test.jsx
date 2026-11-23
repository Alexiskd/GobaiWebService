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

// Importe staleInFlight, le choix des téléchargements inutiles, depuis tileLayer.
import { staleInFlight } from './tileLayer.jsx';

// Test : les téléchargements en cours devenus inutiles.
test('file : clés démarrées listées ; pendant un zoom, seules les images plus voulues sont abandonnées', async () => {
  // Deux places.
  const loader = new TileLoader(2);
  // Demandes qui ne finissent pas d'elles-mêmes : elles attendent l'annulation.
  const hang = (signal) => new Promise((_, reject) => {
    // stop : rejet d'annulation.
    const stop = () => reject(Object.assign(new Error('annulé'), { name: 'AbortError' }));
    // Déjà annulée avant de démarrer : rejet immédiat ; sinon à l'annulation.
    if (signal.aborted) stop(); else signal.addEventListener('abort', stop);
  // Fin de la demande.
  });
  // Deux démarrées (5/1/1 et 6/2/2), une en file (7/4/4).
  const p = ['5/1/1', '6/2/2', '7/4/4'].map((k, i) => loader.load(k, i, hang).catch((e) => e.name));
  // Les deux premières sont en cours.
  assert.deepEqual(loader.startedKeys().sort(), ['5/1/1', '6/2/2']);
  // Ensembles de la couche : 6/2/2 est encore voulue.
  const sets = { wantedKeys: new Set(['6/2/2']), lowKeys: new Set(), pinKeys: new Set(), prefetchKeys: new Set() };
  // Inutiles : 5/1/1 seulement (les clés à préfixe, relief ou calque, ne sont jamais touchées).
  assert.deepEqual(staleInFlight([...loader.startedKeys(), 'h:5/1/1', 'ov:5/1/1'], sets), ['5/1/1']);
  // Abandon : la place se libère et 7/4/4 démarre.
  loader.cancel('5/1/1');
  // Le rejet est une annulation.
  assert.equal(await p[0], 'AbortError');
  // 7/4/4 a pris la place.
  assert.deepEqual(loader.startedKeys().sort(), ['6/2/2', '7/4/4']);
  // Nettoyage : tout est annulé.
  loader.cancelAll();
  // Attend les rejets.
  await Promise.all(p);
// Fin du test.
});

// Importe le préchargement du centre en zoom avant, depuis tileLayer.
import { CENTER_PREFETCH, centerChildren, TileLayer } from './tileLayer.jsx';

// Test : enfants des tuiles du centre de l'écran.
test('zoom avant : enfants des 8 tuiles les plus centrales du niveau le plus fin, sans dépasser le niveau maximal', () => {
  // 12 tuiles du niveau 5 (priorité = rang), et 2 du niveau 4.
  const wanted = [...Array.from({ length: 12 }, (_, i) => ({ z: 5, x: i, y: 3, p: 11 - i })), { z: 4, x: 0, y: 1, p: -5 }, { z: 4, x: 1, y: 1, p: -4 }];
  // Enfants.
  const kids = centerChildren(wanted, 10);
  // 8 parents × 4 enfants.
  assert.equal(kids.length, CENTER_PREFETCH * 4);
  // Tous au niveau 6.
  assert.ok(kids.every((k) => k.z === 6));
  // Les premiers sont ceux du parent le plus central (x = 11, priorité 0), avec la priorité 0.
  assert.deepEqual(kids.slice(0, 4).map((k) => [k.x >> 1, k.p]), [[11, 0], [11, 0], [11, 0], [11, 0]]);
  // Au niveau maximal : aucun enfant.
  assert.deepEqual(centerChildren(wanted, 5), []);
  // Rien de voulu : rien.
  assert.deepEqual(centerChildren([], 10), []);
// Fin du test.
});

// Test : demandes vers la mémoire vive, jamais sans elle.
test('zoom avant : enfants demandés seulement avec une mémoire vive, et pas ceux déjà connus', () => {
  // Couche avec mémoire vive (début) :
  const layer = new TileLayer({ root: { add() {} }, source: { minZoom: 0, maxZoom: 12, loadImage: () => new Promise(() => {}) }, uniforms: {}, ramCapacity: 50, prefetch: true });
  // Une tuile voulue, au centre.
  const wanted = [{ z: 3, x: 2, y: 2, p: 0 }];
  // Un enfant déjà en mémoire vive.
  layer.ram.set('4/4/4', {});
  // Préchargement.
  const keys = layer.prefetchCenter(wanted, 12, 0);
  // Les trois autres enfants sont demandés.
  assert.deepEqual([...keys].sort(), ['4/4/5', '4/5/4', '4/5/5']);
  // Ils sont dans la file.
  assert.ok([...keys].every((k) => layer.loader.has(k)));
  // Sans mémoire vive : rien.
  const noRam = new TileLayer({ root: { add() {} }, source: { minZoom: 0, maxZoom: 12 }, uniforms: {} });
  // Aucune clé.
  assert.equal(noRam.prefetchCenter(wanted, 12, 0).size, 0);
  // Nettoyage : demandes annulées.
  layer.loader.cancelAll();
// Fin du test.
});
