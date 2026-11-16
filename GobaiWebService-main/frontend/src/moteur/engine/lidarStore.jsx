// Base de données des nuages LiDAR, en mémoire du navigateur (1 Go sur ordinateur, 256 Mo sur téléphone).
//
// Chaque nœud téléchargé pour le dôme s'y écrit en même temps qu'il s'affiche. Quand un nœud revient dans le dôme,
// il est lu ici au lieu d'être retéléchargé. Pleine, la base fait sortir ses écritures les plus anciennes, dans l'ordre
// d'arrivée. Rien n'est écrit sur l'appareil : la base vit en mémoire et disparaît à la fermeture de la page.

/** Capacité de la base (octets) : 1 Go sur ordinateur, 256 Mo sur téléphone ou tablette (mémoire limitée). */
// Capacités : ordinateur, puis appareil tenu en main.
export const LIDAR_STORE_BYTES = { desktop: 1_000_000_000, handheld: 256_000_000 };

// Déclare et exporte la classe LidarStore (début).
export class LidarStore {
  /** @param {number} capacity capacité en octets */
  // Constructeur : la capacité (début).
  constructor(capacity) {
    // Capacité en octets.
    this.capacity = capacity;
    // Fichiers par clé, dans l'ordre d'écriture (une Map garde l'ordre d'insertion).
    this.files = new Map();
    // Octets occupés.
    this.used = 0;
    // Octets sortis parce que la base était pleine.
    this.evicted = 0;
    // Lectures servies par la base, et écritures.
    this.hits = 0; this.writes = 0;
  // Fin du constructeur.
  }

  /** Fichier d'une clé (ArrayBuffer), ou null s'il n'y est pas. */
  // get : lit un fichier (début).
  get(key) {
    // Le fichier, s'il y est.
    const file = this.files.get(key);
    // Absent : null.
    if (!file) return null;
    // Une lecture servie de plus.
    this.hits++;
    // Le renvoie.
    return file;
  // Fin de get.
  }

  /** Écrit un fichier ; s'il dépasse la capacité à lui seul, il n'est pas gardé. Pleine : les plus anciens sortent. */
  // put : écrit un fichier (début).
  put(key, file) {
    // Taille du fichier.
    const size = file?.byteLength ?? 0;
    // Vide, déjà présent ou plus grand que la base : rien.
    if (!size || this.files.has(key) || size > this.capacity) return false;
    // L'écrit.
    this.files.set(key, file);
    // Compte ses octets.
    this.used += size;
    // Une écriture de plus.
    this.writes++;
    // Tant que la base déborde : la plus ancienne écriture sort.
    for (const [old, f] of this.files) {
      // Revenue sous la capacité : arrêt.
      if (this.used <= this.capacity) break;
      // Retire le fichier.
      this.files.delete(old);
      // Décompte ses octets.
      this.used -= f.byteLength;
      // Les compte comme sortis.
      this.evicted += f.byteLength;
    // Fin de la boucle.
    }
    // Écrit.
    return true;
  // Fin de put.
  }

  /** État pour l'interface : octets occupés, capacité, fichiers, octets sortis, lectures servies, écritures. */
  // snapshot : l'état de la base.
  snapshot() { return { used: this.used, capacity: this.capacity, files: this.files.size, evicted: this.evicted, hits: this.hits, writes: this.writes }; }

  /** Vide la base. */
  // clear : vide tout (début).
  clear() {
    // Plus aucun fichier.
    this.files.clear();
    // Plus rien d'occupé.
    this.used = 0;
  // Fin de clear.
  }
// Fin de la classe LidarStore.
}
