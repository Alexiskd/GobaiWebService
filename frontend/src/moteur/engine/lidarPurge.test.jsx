// Importe test, le lanceur de tests intégré à Node.
import test from 'node:test';
// Importe assert en mode strict, pour les vérifications.
import assert from 'node:assert/strict';
// Importe la fonction testée et ses constantes.
import { LIDAR_PURGE_KEY, LIDAR_PURGE_VERSION, purgeLidarDownloads } from './lidarPurge';

// Faux stockage local : une table en mémoire.
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
// Faux Cache Storage : une liste de noms.
const fakeCaches = (names) => ({ names: [...names], keys() { return Promise.resolve([...this.names]); }, delete(n) { this.names = this.names.filter((x) => x !== n); return Promise.resolve(true); } });

// Désinstallation : les caches LiDAR partent, une seule fois par version, les autres restent.
test('purgeLidarDownloads : supprime les nuages LiDAR une fois par version', async () => {
  // Un stockage vide et trois caches, dont un LiDAR.
  const storage = fakeStorage(), store = fakeCaches(['lidar-hd-v1', 'relief-v1', 'gobai-shell-v1']);
  // Première ouverture : le cache LiDAR est supprimé.
  assert.equal(await purgeLidarDownloads(storage, store), 1);
  // Les autres restent.
  assert.deepEqual(store.names, ['relief-v1', 'gobai-shell-v1']);
  // La version est retenue.
  assert.equal(storage.getItem(LIDAR_PURGE_KEY), LIDAR_PURGE_VERSION);
  // Un cache LiDAR réapparu n'est plus touché pour cette version.
  store.names.push('lidar-hd-v1');
  // Deuxième ouverture : rien.
  assert.equal(await purgeLidarDownloads(storage, store), 0);
  // Sans Cache Storage : rien, sans erreur.
  assert.equal(await purgeLidarDownloads(fakeStorage(), undefined), 0);
});
