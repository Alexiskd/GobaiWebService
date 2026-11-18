/**
 * Cache LRU borné. `get` et `touch` marquent l'entrée comme récente ; au-delà de `capacity`,
 * les plus anciennes sont retirées et `onEvict(key, value)` est appelé (libération des textures).
 */
// Déclare et exporte la classe LruCache.
export class LruCache {
  // Constructeur : la capacité et le rappel d'éviction (sans effet par défaut).
  constructor(capacity, onEvict = () => {}) {
    // Garde la capacité.
    this.capacity = capacity;
    // Garde le rappel.
    this.onEvict = onEvict;
    // Table des entrées, dans l'ordre de la plus ancienne à la plus récente.
    this.map = new Map();
  // Fin du constructeur.
  }
  // size : nombre d'entrées.
  get size() { return this.map.size; }
  // has : vrai si la clé est présente.
  has(key) { return this.map.has(key); }
  /** Lecture sans effet sur l'ordre. */
  // peek : lit une valeur sans la marquer comme récente.
  peek(key) { return this.map.get(key); }
  // get : lit une valeur et la marque comme récente.
  get(key) {
    // Clé absente : indéfini.
    if (!this.map.has(key)) return undefined;
    // La valeur.
    const v = this.map.get(key);
    // Retire l'entrée…
    this.map.delete(key);
    // … et la remet en dernier.
    this.map.set(key, v);
    // Renvoie la valeur.
    return v;
  // Fin de get.
  }
  // touch : marque une entrée comme récente.
  touch(key) { this.get(key); }
  // set : enregistre une valeur.
  set(key, value) {
    // Si la clé existe déjà, retire l'ancienne entrée.
    if (this.map.has(key)) this.map.delete(key);
    // Ajoute l'entrée en dernier.
    this.map.set(key, value);
    // Tant que la capacité est dépassée.
    while (this.map.size > this.capacity) {
      // Prend l'entrée la plus ancienne.
      const [oldKey, oldValue] = this.map.entries().next().value;
      // La retire.
      this.map.delete(oldKey);
      // Prévient le rappel d'éviction.
      this.onEvict(oldKey, oldValue);
    // Fin de la boucle.
    }
  // Fin de set.
  }
  // delete : retire une entrée.
  delete(key) {
    // Clé absente : faux.
    if (!this.map.has(key)) return false;
    // La valeur.
    const v = this.map.get(key);
    // Retire l'entrée.
    this.map.delete(key);
    // Prévient le rappel d'éviction.
    this.onEvict(key, v);
    // Entrée retirée.
    return true;
  // Fin de delete.
  }
  // clear : retire toutes les entrées, une par une.
  clear() { [...this.map.keys()].forEach((k) => this.delete(k)); }
  // keys : la liste des clés.
  keys() { return [...this.map.keys()]; }
// Fin de la classe LruCache.
}
