// Cache mémoire borné en octets, partagé par les services qui gardent des fichiers en mémoire (tuiles de la Lune).

/** Cache mémoire borné en octets (les fichiers les plus anciennement lus sortent les premiers). */
// Classe ByteCache : cache mémoire limité en octets.
export class ByteCache {
  // Fichiers gardés, dans l'ordre de leur dernière lecture (une Map garde l'ordre d'insertion).
  private readonly items = new Map<string, Buffer>();
  // Octets occupés.
  private used = 0;

  // Constructeur : reçoit la capacité en octets ; corps vide.
  constructor(private readonly capacity: number) {}

  // Méthode get : lit un fichier du cache.
  get(key: string): Buffer | undefined {
    // Cherche le fichier.
    const hit = this.items.get(key);
    // Trouvé : on le retire et on le remet, il devient le plus récemment lu.
    if (hit) { this.items.delete(key); this.items.set(key, hit); }
    // Renvoie le fichier, ou undefined.
    return hit;
  // Fin de get.
  }

  // Méthode set : range un fichier dans le cache.
  set(key: string, body: Buffer): void {
    // Plus grand que le cache entier : on ne le garde pas.
    if (body.length > this.capacity) return;
    // Ancienne version sous la même clé ?
    const old = this.items.get(key);
    // Si oui, on retire sa taille du total et on l'enlève.
    if (old) { this.used -= old.length; this.items.delete(key); }
    // Range le fichier, en dernière position.
    this.items.set(key, body);
    // Ajoute sa taille au total.
    this.used += body.length;
    // Parcourt les fichiers du plus ancien au plus récent :
    for (const [k, v] of this.items) {
      // sous la capacité : on s'arrête ;
      if (this.used <= this.capacity) break;
      // sinon on enlève le plus ancien,
      this.items.delete(k);
      // et on retire sa taille du total.
      this.used -= v.length;
    // Fin du parcours.
    }
  // Fin de set.
  }

  // Accesseur bytes : octets occupés.
  get bytes(): number { return this.used; }
  // Accesseur size : nombre de fichiers gardés.
  get size(): number { return this.items.size; }
// Fin de ByteCache.
}
