// Fichiers de tuiles gardés sur le disque du navigateur (Cache Storage), avec un plafond en nombre de fichiers.
// Le relief et les calques LiDAR HD déjà vus y restent : au retour sur un lieu, rien n'est redemandé au réseau.
// Quand le plafond est dépassé, les fichiers les plus anciens sortent (Cache Storage rend ses clés dans l'ordre
// d'enregistrement).

/** Cache du relief (tuiles d'altitude et de profondeur) et plafonds, ordinateur puis téléphone. */
// Nom du cache disque du relief.
export const RELIEF_DISK = 'relief-v1';
// Son nombre maximal de fichiers : ordinateur, puis appareil tenu en main.
export const RELIEF_DISK_MAX = { desktop: 3000, handheld: 900 };
/** Cache des calques LiDAR HD (ombrages de l'IGN), tous niveaux. */
// Nom du cache disque des calques LiDAR HD.
export const LIDAR_DISK = 'lidar-hd-v1';
// Son nombre maximal de fichiers.
export const LIDAR_DISK_MAX = { desktop: 6000, handheld: 1800 };

/**
 * Nombre de fichiers à retirer pour revenir sous le plafond, avec une marge de 10 % : le ménage ne recommence pas à
 * chaque nouveau fichier. 0 tant que le plafond n'est pas dépassé.
 */
// Déclare et exporte trimCount : le nombre de fichiers et le plafond.
export function trimCount(count, max) {
  // Sans plafond, ou plafond non dépassé : rien à retirer.
  if (!(max > 0) || count <= max) return 0;
  // Sinon : de quoi revenir à 90 % du plafond.
  return count - Math.floor(max * 0.9);
// Fin de trimCount.
}

/** Retire du cache ses fichiers les plus anciens au-delà du plafond. Renvoie le nombre de fichiers retirés. */
// Déclare et exporte trimDisk : la promesse du cache et le plafond.
export async function trimDisk(cacheP, max) {
  // Attend le cache.
  const cache = await cacheP;
  // Pas de cache : rien de retiré.
  if (!cache) return 0;
  // Liste ses clés, de la plus ancienne à la plus récente.
  const keys = await cache.keys();
  // Nombre de fichiers à retirer.
  const drop = trimCount(keys.length, max);
  // Retire les plus anciens.
  await Promise.all(keys.slice(0, drop).map((key) => cache.delete(key)));
  // Renvoie ce nombre.
  return drop;
// Fin de trimDisk.
}

// Nombre de fichiers enregistrés pendant la session, par cache.
const writes = new Map(); // nom du cache → fichiers enregistrés pendant la session

/**
 * À appeler après chaque fichier enregistré : fait le ménage au premier enregistrement de la session (une visite
 * précédente a pu remplir le cache), puis tous les `every` fichiers. Sans plafond, ne fait rien.
 */
// Déclare et exporte diskWritten : le nom du cache, sa promesse, le plafond et la fréquence du ménage (64 par défaut).
export function diskWritten(name, cacheP, max, every = 64) {
  // Sans plafond : rien à faire.
  if (!(max > 0)) return false;
  // Nombre de fichiers enregistrés, celui-ci compris.
  const n = (writes.get(name) || 0) + 1;
  // Le mémorise.
  writes.set(name, n);
  // Ni le premier, ni un multiple de la fréquence : pas de ménage.
  if (n !== 1 && n % every !== 0) return false;
  // Lance le ménage ; un échec est ignoré.
  trimDisk(cacheP, max).catch(() => {}); // ménage facultatif : le cache reste utilisable s'il échoue
  // Ménage lancé.
  return true;
// Fin de diskWritten.
}

/** Ouvre un cache disque, ou null s'il n'y en a pas (contexte non sécurisé, navigation privée stricte). */
// Déclare et exporte openDisk : le nom du cache et le stockage (celui du navigateur par défaut).
export function openDisk(name, store = globalThis.caches) {
  // Sans nom ou sans stockage : null.
  if (!name || !store) return null;
  // Ouvre le cache ; null en cas d'échec.
  return store.open(name).catch(() => null);
// Fin de openDisk.
}
