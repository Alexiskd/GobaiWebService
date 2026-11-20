/**
 * File de chargement : au plus `concurrency` chargements simultanés, plus petite priorité d'abord.
 * `load(key, run)` renvoie une promesse ; `cancel(key)` retire une demande pas encore démarrée.
 * `run(signal)` fait le vrai travail (charger une image) et doit respecter `signal.aborted`.
 */
// Déclare et exporte la classe TileLoader (début).
export class TileLoader {
  // Constructeur : le nombre de chargements simultanés, 6 par défaut.
  constructor(concurrency = 6) {
    // Garde ce nombre.
    this.concurrency = concurrency;
    // Nombre de chargements en cours : 0 au départ.
    this.active = 0;
    // File des demandes pas encore démarrées.
    this.queue = [];            // { key, priority, run, resolve, reject }
    // Table de toutes les demandes, par clé.
    this.pending = new Map();   // key → entrée (en file ou en cours)
  // Fin du constructeur.
  }

  // has : vrai quand une demande existe pour cette clé.
  has(key) { return this.pending.has(key); }
  /** Clés des demandes en file (pas encore démarrées). */
  // queuedKeys : la liste des clés de la file.
  queuedKeys() { return this.queue.map((e) => e.key); }
  // queued : le nombre de demandes dans la file.
  get queued() { return this.queue.length; }

  // load : demande un chargement, avec sa clé, sa priorité et la fonction qui fait le travail (début).
  load(key, priority, run) {
    // Demande déjà enregistrée pour cette clé.
    const existing = this.pending.get(key);
    // S'il y en a une (début).
    if (existing) {
      // Elle garde la plus petite des deux priorités.
      existing.priority = Math.min(existing.priority, priority);
      // Renvoie la promesse déjà créée.
      return existing.promise;
    // Fin du cas d'une demande existante.
    }
    // Nouvelle entrée : pas encore démarrée, avec son contrôleur d'annulation.
    const entry = { key, priority, run, started: false, ctrl: new AbortController() };
    // Sa promesse, dont les fonctions de résolution et de rejet sont rangées dans l'entrée.
    entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
    // Enregistre l'entrée dans la table.
    this.pending.set(key, entry);
    // L'ajoute à la file.
    this.queue.push(entry);
    // Lance les chargements possibles.
    this.pump();
    // Renvoie la promesse.
    return entry.promise;
  // Fin de load.
  }

  /** Annule une demande : retirée de la file si elle n'a pas démarré, sinon signalée via `signal`. */
  // cancel : annule la demande d'une clé (début).
  cancel(key) {
    // L'entrée de cette clé.
    const e = this.pending.get(key);
    // Aucune : rien à faire.
    if (!e) return;
    // Signale l'annulation au travail en cours.
    e.ctrl.abort();
    // Si elle n'a pas démarré (début).
    if (!e.started) {
      // La retire de la file.
      this.queue.splice(this.queue.indexOf(e), 1);
      // La retire de la table.
      this.pending.delete(key);
      // Rejette sa promesse avec une erreur nommée AbortError.
      e.reject(Object.assign(new Error('annulé'), { name: 'AbortError' }));
    // Fin du cas d'une demande pas démarrée.
    }
  // Fin de cancel.
  }

  // cancelAll : annule toutes les demandes, à partir d'une copie de la liste des clés.
  cancelAll() { [...this.pending.keys()].forEach((k) => this.cancel(k)); }

  /** Met à jour la priorité (distance) des demandes en file. */
  // reprioritize : recalcule la priorité de chaque demande de la file avec la fonction reçue.
  reprioritize(fn) { this.queue.forEach((e) => { e.priority = fn(e.key, e.priority); }); }

  // pump : démarre des chargements tant qu'il reste de la place (début).
  pump() {
    // Tant que la limite n'est pas atteinte et que la file n'est pas vide (début).
    while (this.active < this.concurrency && this.queue.length) {
      // Indice de la meilleure demande : la première au départ.
      let best = 0;
      // Parcourt la file et garde l'indice de la plus petite priorité.
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].priority < this.queue[best].priority) best = i;
      // Retire cette demande de la file.
      const e = this.queue.splice(best, 1)[0];
      // La marque comme démarrée.
      e.started = true;
      // Un chargement en cours de plus.
      this.active++;
      // Part d'une promesse déjà résolue, pour qu'une erreur lancée par run devienne un rejet.
      Promise.resolve()
        // Lance le travail avec le signal d'annulation.
        .then(() => e.run(e.ctrl.signal))
        // Transmet le résultat ou l'erreur à la promesse de la demande.
        .then(e.resolve, e.reject)
        // Dans tous les cas, à la fin (début).
        .finally(() => {
          // Un chargement en cours de moins.
          this.active--;
          // Retire la demande de la table.
          this.pending.delete(e.key);
          // Relance les chargements possibles.
          this.pump();
        // Fin du traitement de fin.
        });
    // Fin de la boucle.
    }
  // Fin de pump.
  }
// Fin de la classe TileLoader.
}
