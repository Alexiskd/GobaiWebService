/**
 * File de chargement : au plus `concurrency` chargements simultanés, plus petite priorité d'abord.
 * `load(key, run)` renvoie une promesse ; `cancel(key)` retire une demande pas encore démarrée.
 * `run(signal)` fait le vrai travail (charger une image) et doit respecter `signal.aborted`.
 */
export class TileLoader {
  constructor(concurrency = 6) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];            // { key, priority, run, resolve, reject }
    this.pending = new Map();   // key → entrée (en file ou en cours)
  }

  has(key) { return this.pending.has(key); }
  /** Clés des demandes en file (pas encore démarrées). */
  queuedKeys() { return this.queue.map((e) => e.key); }
  get queued() { return this.queue.length; }

  load(key, priority, run) {
    const existing = this.pending.get(key);
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      return existing.promise;
    }
    const entry = { key, priority, run, started: false, ctrl: new AbortController() };
    entry.promise = new Promise((resolve, reject) => { entry.resolve = resolve; entry.reject = reject; });
    this.pending.set(key, entry);
    this.queue.push(entry);
    this.pump();
    return entry.promise;
  }

  /** Annule une demande : retirée de la file si elle n'a pas démarré, sinon signalée via `signal`. */
  cancel(key) {
    const e = this.pending.get(key);
    if (!e) return;
    e.ctrl.abort();
    if (!e.started) {
      this.queue.splice(this.queue.indexOf(e), 1);
      this.pending.delete(key);
      e.reject(Object.assign(new Error('annulé'), { name: 'AbortError' }));
    }
  }

  cancelAll() { [...this.pending.keys()].forEach((k) => this.cancel(k)); }

  /** Met à jour la priorité (distance) des demandes en file. */
  reprioritize(fn) { this.queue.forEach((e) => { e.priority = fn(e.key, e.priority); }); }

  pump() {
    while (this.active < this.concurrency && this.queue.length) {
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) if (this.queue[i].priority < this.queue[best].priority) best = i;
      const e = this.queue.splice(best, 1)[0];
      e.started = true;
      this.active++;
      Promise.resolve()
        .then(() => e.run(e.ctrl.signal))
        .then(e.resolve, e.reject)
        .finally(() => {
          this.active--;
          this.pending.delete(e.key);
          this.pump();
        });
    }
  }
}
