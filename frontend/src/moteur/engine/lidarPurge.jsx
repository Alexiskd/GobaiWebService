// Désinstallation des nuages LiDAR déjà téléchargés, à la mise à jour de l'app.
//
// Les nuages de points ne sont plus gardés sur l'appareil : chaque nuage est téléchargé quand il entre dans le dôme et
// supprimé dès qu'il en sort (voir lidarPoints.jsx). À la première ouverture après cette mise à jour, tout ce que les
// versions précédentes avaient enregistré est supprimé : les caches disque LiDAR (Cache Storage, noms en « lidar »).
// Les anciens nœuds gardés par le cache HTTP du navigateur ne sont plus jamais demandés : leur adresse a changé
// (version « ign2 » côté serveur), le navigateur les efface de lui-même.

/** Version de la désinstallation : la changer relance la suppression une fois chez chaque visiteur. */
// Version « 2 ».
export const LIDAR_PURGE_VERSION = '2';
/** Clé du stockage local qui retient la dernière désinstallation faite. */
// Clé « gobai:lidar-purge ».
export const LIDAR_PURGE_KEY = 'gobai:lidar-purge';

/**
 * Supprime une fois par version les nuages LiDAR enregistrés sur l'appareil. Renvoie une promesse du nombre de caches
 * supprimés (0 si c'était déjà fait ou si le navigateur n'a pas de Cache Storage). Sans effet en cas d'erreur.
 */
// Déclare et exporte purgeLidarDownloads : le stockage local et le Cache Storage (ceux du navigateur par défaut).
export async function purgeLidarDownloads(storage = globalThis.localStorage, store = globalThis.caches) {
  // Essai (début).
  try {
    // Déjà faite pour cette version : rien à faire.
    if (storage?.getItem(LIDAR_PURGE_KEY) === LIDAR_PURGE_VERSION) return 0;
    // Noms des caches de l'appareil, s'il y en a.
    const names = store ? await store.keys() : [];
    // Ceux des nuages LiDAR.
    const lidar = names.filter((name) => name.startsWith('lidar'));
    // Les supprime tous.
    await Promise.all(lidar.map((name) => store.delete(name)));
    // Retient que la désinstallation est faite pour cette version.
    storage?.setItem(LIDAR_PURGE_KEY, LIDAR_PURGE_VERSION);
    // Renvoie le nombre de caches supprimés.
    return lidar.length;
  // Stockage refusé ou Cache Storage indisponible : rien.
  } catch { return 0; }
// Fin de purgeLidarDownloads.
}
