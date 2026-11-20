/** Registre central des systèmes et astres connus du moteur Gobai Space. */
export class SystemRegistry {
  #systems = new Map();

  register(system) {
    if (!system || typeof system.id !== 'string' || !system.id.trim()) {
      throw new TypeError('Un système doit posséder un id non vide.');
    }
    if (this.#systems.has(system.id)) {
      throw new Error(`Le système "${system.id}" est déjà enregistré.`);
    }
    this.#systems.set(system.id, Object.freeze({ ...system }));
    return this.#systems.get(system.id);
  }

  upsert(system) {
    if (!system || typeof system.id !== 'string' || !system.id.trim()) {
      throw new TypeError('Un système doit posséder un id non vide.');
    }
    const previous = this.#systems.get(system.id) ?? {};
    const value = Object.freeze({ ...previous, ...system });
    this.#systems.set(system.id, value);
    return value;
  }

  get(id) { return this.#systems.get(id) ?? null; }
  has(id) { return this.#systems.has(id); }
  remove(id) { return this.#systems.delete(id); }
  values() { return [...this.#systems.values()]; }
  clear() { this.#systems.clear(); }
  get size() { return this.#systems.size; }
}
