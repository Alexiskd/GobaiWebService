/**
 * File de chargement : au plus `concurrency` chargements simultanés, plus petite priorité d'abord (à priorité égale,
 * la plus ancienne demande d'abord). La file est un tas binaire : prendre la meilleure demande, en ajouter une,
 * changer sa priorité ou l'annuler coûte O(log n) au lieu d'un parcours de toute la file (des centaines de demandes
 * pendant un zoom, parcourues à chaque chargement terminé).
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
    // File des demandes pas encore démarrées : tas binaire (la meilleure en tête), chaque entrée connaît sa place.
    this.queue = [];            // { key, priority, seq, index, run, resolve, reject }
    // Numéro d'ordre des demandes : départage les priorités égales (la plus ancienne d'abord).
    this.seq = 0;
    // Table de toutes les demandes, par clé.
    this.pending = new Map();   // key → entrée (en file ou en cours)
  // Fin du constructeur.
  }

  // has : vrai quand une demande existe pour cette clé.
  has(key) { return this.pending.has(key); }
  /** Clés des demandes en file (pas encore démarrées). */
  // queuedKeys : la liste des clés de la file.
  queuedKeys() { return this.queue.map((e) => e.key); }
  /** Clés des demandes déjà démarrées (téléchargement en cours). */
  // startedKeys : la liste des clés en cours (début).
  startedKeys() {
    // Clés en cours.
    const out = [];
    // Toutes les demandes démarrées.
    for (const e of this.pending.values()) if (e.started) out.push(e.key);
    // Renvoie la liste.
    return out;
  // Fin de startedKeys.
  }
  // queued : le nombre de demandes dans la file.
  get queued() { return this.queue.length; }

  // load : demande un chargement, avec sa clé, sa priorité et la fonction qui fait le travail (début).
  load(key, priority, run) {
    // Demande déjà enregistrée pour cette clé.
    const existing = this.pending.get(key);
    // S'il y en a une (début).
    if (existing) {
      // Priorité plus petite et demande encore en file (début).
      if (priority < existing.priority && !existing.started) {
        // Elle la prend.
        existing.priority = priority;
        // Et remonte dans le tas.
        this.up(existing.index);
      // Sinon : elle garde la plus petite des deux.
      } else existing.priority = Math.min(existing.priority, priority);
      // Renvoie la promesse déjà créée.
      return existing.promise;
    // Fin du cas d'une demande existante.
    }
    // Nouvelle entrée : pas encore démarrée, avec son contrôleur d'annulation.
    const entry = { key, priority, seq: this.seq++, index: -1, run, started: false, ctrl: new AbortController() };
    // Sa promesse, dont les fonctions de résolution et de rejet sont rangées dans l'entrée.
    entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
    // Enregistre l'entrée dans la table.
    this.pending.set(key, entry);
    // L'ajoute au tas.
    this.push(entry);
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
      // La retire du tas, à sa place.
      this.removeAt(e.index);
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
  // reprioritize : recalcule la priorité de chaque demande de la file avec la fonction reçue (début).
  reprioritize(fn) {
    // Nouvelle priorité de chaque demande.
    this.queue.forEach((e) => { e.priority = fn(e.key, e.priority); });
    // Le tas est reconstruit en une passe, du dernier parent à la racine.
    for (let i = (this.queue.length >> 1) - 1; i >= 0; i--) this.down(i);
  // Fin de reprioritize.
  }

  // ---------------------------------------------------------------- tas binaire

  // before : vrai si la demande a passe avant b (plus petite priorité, puis plus ancienne).
  before(a, b) { return a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq); }

  // swap : échange deux places du tas et met à jour les places notées (début).
  swap(i, j) {
    // Les deux entrées.
    const q = this.queue, a = q[i], b = q[j];
    // Échange.
    q[i] = b; q[j] = a;
    // Places notées.
    b.index = i; a.index = j;
  // Fin de swap.
  }

  // up : fait remonter une entrée tant qu'elle passe avant son parent (début).
  up(i) {
    // Tant qu'elle n'est pas en tête (début).
    while (i > 0) {
      // Place du parent.
      const parent = (i - 1) >> 1;
      // Le parent passe déjà avant : terminé.
      if (!this.before(this.queue[i], this.queue[parent])) return;
      // Sinon : échange, et on continue depuis le parent.
      this.swap(i, parent); i = parent;
    // Fin de la boucle.
    }
  // Fin de up.
  }

  // down : fait descendre une entrée tant qu'un de ses enfants passe avant elle (début).
  down(i) {
    // Taille du tas.
    const n = this.queue.length;
    // Sans fin, jusqu'au retour (début).
    for (;;) {
      // Enfants gauche et droit, et meilleure des trois places.
      const l = 2 * i + 1, r = l + 1;
      // Meilleure place : la sienne au départ.
      let best = i;
      // Enfant gauche meilleur.
      if (l < n && this.before(this.queue[l], this.queue[best])) best = l;
      // Enfant droit meilleur.
      if (r < n && this.before(this.queue[r], this.queue[best])) best = r;
      // Elle est la meilleure : terminé.
      if (best === i) return;
      // Sinon : échange, et on continue plus bas.
      this.swap(i, best); i = best;
    // Fin de la boucle.
    }
  // Fin de down.
  }

  // push : ajoute une entrée au tas (début).
  push(e) {
    // Sa place : la dernière.
    e.index = this.queue.length;
    // Ajoutée au bout.
    this.queue.push(e);
    // Remonte à sa place.
    this.up(e.index);
  // Fin de push.
  }

  // removeAt : retire l'entrée d'une place du tas et la renvoie (début).
  removeAt(i) {
    // Le tas.
    const q = this.queue;
    // Entrée retirée.
    const e = q[i];
    // Dernière entrée.
    const last = q.pop();
    // Si l'entrée retirée n'était pas la dernière (début).
    if (i < q.length) {
      // La dernière prend sa place.
      q[i] = last; last.index = i;
      // Puis descend ou remonte selon sa priorité.
      this.down(i); this.up(last.index);
    // Fin de ce cas.
    }
    // L'entrée retirée n'a plus de place.
    e.index = -1;
    // La renvoie.
    return e;
  // Fin de removeAt.
  }

  // pump : démarre des chargements tant qu'il reste de la place (début).
  pump() {
    // Tant que la limite n'est pas atteinte et que la file n'est pas vide (début).
    while (this.active < this.concurrency && this.queue.length) {
      // Retire la meilleure demande : la tête du tas.
      const e = this.removeAt(0);
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
