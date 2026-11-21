// Désinstallation de tout ce que l'app avait gardé sur l'appareil, à la mise à jour.
//
// Plus rien n'est gardé sur le disque du navigateur : les tuiles sont téléchargées sans cache et
// ne vivent qu'en mémoire (voir tiles/tileSource.jsx, loadImage). À la première ouverture après
// cette mise à jour, tous les caches enregistrés par les versions précédentes (Cache Storage : tuiles de la Terre, de
// la Lune, des planètes, relief, calques et photos drapées) sont supprimés. Seule la page d'accueil du
// service worker (« gobai-shell-… », ouverture hors ligne de l'app installée) est gardée.

/** Version de la désinstallation : la changer relance la suppression une fois chez chaque visiteur. */
// Version « 3 » (la version 2 ne supprimait que les nuages LiDAR).
export const STORAGE_PURGE_VERSION = '3';
/** Clé du stockage local qui retient la dernière désinstallation faite. */
// Clé « gobai:storage-purge ».
export const STORAGE_PURGE_KEY = 'gobai:storage-purge';
/** Caches gardés : la page d'accueil du service worker. */
// Préfixe « gobai-shell- ».
const KEEP_PREFIX = 'gobai-shell-';

/**
 * Supprime une fois par version tous les caches de tuiles et de nuages enregistrés sur l'appareil. Renvoie une
 * promesse du nombre de caches supprimés (0 si c'était déjà fait ou sans Cache Storage). Sans effet en cas d'erreur.
 */
// Déclare et exporte purgeStoredTiles : le stockage local et le Cache Storage (ceux du navigateur par défaut).
export async function purgeStoredTiles(storage = globalThis.localStorage, store = globalThis.caches) {
  // Essai (début).
  try {
    // Déjà faite pour cette version : rien à faire.
    if (storage?.getItem(STORAGE_PURGE_KEY) === STORAGE_PURGE_VERSION) return 0;
    // Noms des caches de l'appareil, s'il y en a.
    const names = store ? await store.keys() : [];
    // Tous, sauf la page d'accueil du service worker.
    const gone = names.filter((name) => !name.startsWith(KEEP_PREFIX));
    // Les supprime.
    await Promise.all(gone.map((name) => store.delete(name)));
    // Retient que la désinstallation est faite pour cette version.
    storage?.setItem(STORAGE_PURGE_KEY, STORAGE_PURGE_VERSION);
    // Renvoie le nombre de caches supprimés.
    return gone.length;
  // Stockage refusé ou Cache Storage indisponible : rien.
  } catch { return 0; }
// Fin de purgeStoredTiles.
}
