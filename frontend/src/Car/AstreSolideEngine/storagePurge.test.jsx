// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la fonction testée et ses constantes.
import { STORAGE_PURGE_KEY, STORAGE_PURGE_VERSION, purgeStoredTiles } from './storagePurge.jsx';

// Faux stockage local : une table en mémoire.
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
// Faux Cache Storage : une liste de noms.
const fakeCaches = (names) => ({ names: [...names], keys() { return Promise.resolve([...this.names]); }, delete(n) { this.names = this.names.filter((x) => x !== n); return Promise.resolve(true); } });

// Désinstallation : tous les caches partent, une seule fois par version, sauf la page du service worker.
test('purgeStoredTiles : supprime tous les caches de l\'appareil une fois par version', async () => {
  // Un stockage vide et les caches des versions précédentes.
  const storage = fakeStorage(), store = fakeCaches(['earth-direct-v1', 'moon-tiles-v3', 'mars-tiles-v1', 'relief-v1', 'lidar-hd-v1', 'lidar-drape-v1', 'gobai-shell-v1']);
  // Première ouverture : six caches supprimés.
  assert.equal(await purgeStoredTiles(storage, store), 6);
  // Seule la page du service worker reste.
  assert.deepEqual(store.names, ['gobai-shell-v1']);
  // La version est retenue.
  assert.equal(storage.getItem(STORAGE_PURGE_KEY), STORAGE_PURGE_VERSION);
  // Un cache réapparu n'est plus touché pour cette version.
  store.names.push('moon-tiles-v3');
  // Deuxième ouverture : rien.
  assert.equal(await purgeStoredTiles(storage, store), 0);
  // Sans Cache Storage : rien, sans erreur.
  assert.equal(await purgeStoredTiles(fakeStorage(), undefined), 0);
});
