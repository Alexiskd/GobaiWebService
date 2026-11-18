/** Ordonnanceur coopératif : exécute un nombre borné de tâches par image. */
export class RenderScheduler {
  #tasks = new Map();
  #sequence = 0;

  constructor({ maxTasksPerFrame = 3, onError } = {}) {
    if (!Number.isInteger(maxTasksPerFrame) || maxTasksPerFrame < 1) {
      throw new RangeError('maxTasksPerFrame doit être un entier supérieur ou égal à 1.');
    }
    this.maxTasksPerFrame = maxTasksPerFrame;
    this.onError = typeof onError === 'function' ? onError : null;
  }

  schedule({ id, run, priority = 0 }) {
    if (typeof id !== 'string' || !id) throw new TypeError('id de tâche requis.');
    if (typeof run !== 'function') throw new TypeError(`La tâche "${id}" doit fournir run().`);
    if (!Number.isFinite(priority)) throw new TypeError('priority doit être un nombre fini.');
    const previous = this.#tasks.get(id);
    this.#tasks.set(id, {
      id,
      run,
      priority,
      sequence: previous?.sequence ?? this.#sequence++,
    });
    return id;
  }

  cancel(id) { return this.#tasks.delete(id); }
  has(id) { return this.#tasks.has(id); }
  clear() { this.#tasks.clear(); }
  get size() { return this.#tasks.size; }

  /** Les tâches non exécutées restent en attente pour les images suivantes. */
  flush({ maxTasks = this.maxTasksPerFrame } = {}) {
    if (!Number.isInteger(maxTasks) || maxTasks < 0) {
      throw new RangeError('maxTasks doit être un entier positif ou nul.');
    }
    const ordered = [...this.#tasks.values()].sort(
      (a, b) => b.priority - a.priority || a.sequence - b.sequence,
    );
    const selected = ordered.slice(0, maxTasks);
    const results = [];
    for (const task of selected) {
      // Retirer avant exécution permet à la tâche de se reprogrammer elle-même.
      if (this.#tasks.get(task.id) === task) this.#tasks.delete(task.id);
      try {
        task.run();
        results.push({ id: task.id, status: 'completed' });
      } catch (error) {
        results.push({ id: task.id, status: 'failed', error });
        this.onError?.(error, task.id);
      }
    }
    return { executed: selected.length, remaining: this.#tasks.size, results };
  }
}
