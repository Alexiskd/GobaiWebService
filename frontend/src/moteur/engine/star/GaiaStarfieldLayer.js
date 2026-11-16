const DEFAULT_BUDGET = Object.freeze({ maxStars: 1_000_000, maxMagnitude: 20, pointSize: 2.2, maxDistancePc: Infinity });

/**
 * Rendu Gaia en buffers GPU préalloués : un seul THREE.Points, capacité géométrique
 * croissante, mises à jour dynamiques et LOD par magnitude/distance.
 * Les positions restent en parsecs ICRS et sont recentrées via l'origine flottante.
 */
export class GaiaStarfieldLayer {
  constructor({ THREE, scene, parsecToSceneUnits, maxStars = DEFAULT_BUDGET.maxStars, budget = {} }) {
    if (!THREE?.BufferGeometry || !THREE?.Points || !scene || !Number.isFinite(parsecToSceneUnits)) throw new TypeError('Dépendances THREE, scène et échelle parsec requises.');
    this.THREE = THREE;
    this.scene = scene;
    this.scale = parsecToSceneUnits;
    this.stars = new Map();
    this.residentIds = null;
    this.originPc = { x: 0, y: 0, z: 0 };
    this.budget = { ...DEFAULT_BUDGET, ...budget, maxStars: Math.max(1, Math.floor(Number(budget.maxStars ?? maxStars) || DEFAULT_BUDGET.maxStars)) };
    this.capacity = 0;
    this.renderedStars = 0;
    this.truncatedStars = 0;
    this.positions = new Float32Array(0);
    this.colors = new Float32Array(0);
    this.geometry = new THREE.BufferGeometry();
    this.positionAttribute = null;
    this.colorAttribute = null;
    this.material = new THREE.PointsMaterial({ size: this.budget.pointSize, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.name = 'Gobai Gaia DR3 Starfield';
    this.points.frustumCulled = false;
    this.points.renderOrder = -5;
    this.scene.add(this.points);
  }

  setStars(stars = []) {
    for (const star of stars) {
      if (star?.id && star.positionPc && ['x', 'y', 'z'].every((axis) => Number.isFinite(star.positionPc[axis]))) this.stars.set(star.id, star);
    }
    this.#rebuild();
    return this.stars.size;
  }

  removeStars(ids = []) {
    for (const id of ids) this.stars.delete(id);
    this.#rebuild();
    return this.stars.size;
  }

  setResidentIds(ids = null) {
    const next = ids === null ? null : new Set(ids);
    const same = this.residentIds === null ? next === null : next !== null && this.residentIds.size === next.size && [...this.residentIds].every((id) => next.has(id));
    if (same) return this.renderedStars;
    this.residentIds = next;
    this.#rebuild();
    return this.renderedStars;
  }

  setRenderBudget(options = {}) {
    const next = { ...this.budget, ...options };
    if (options.maxStars !== undefined) next.maxStars = Math.max(1, Math.floor(Number(options.maxStars) || 1));
    if (options.maxMagnitude !== undefined && !Number.isFinite(Number(options.maxMagnitude))) throw new TypeError('maxMagnitude doit être fini.');
    if (options.maxDistancePc !== undefined && !(Number.isFinite(Number(options.maxDistancePc)) || options.maxDistancePc === Infinity)) throw new TypeError('maxDistancePc invalide.');
    if (options.pointSize !== undefined && (!Number.isFinite(Number(options.pointSize)) || Number(options.pointSize) <= 0)) throw new TypeError('pointSize doit être positif.');
    this.budget = next;
    this.material.size = next.pointSize;
    this.#rebuild();
    return this.getStats();
  }

  updateOrigin(originPc) {
    if (!originPc || !['x', 'y', 'z'].every((axis) => Number.isFinite(originPc[axis]))) return false;
    const changed = ['x', 'y', 'z'].some((axis) => Math.abs(this.originPc[axis] - originPc[axis]) > 1e-8);
    if (!changed) return false;
    this.originPc = { x: originPc.x, y: originPc.y, z: originPc.z };
    this.#writeBuffers(this.#selectStars());
    return true;
  }

  #selectStars() {
    const selected = [];
    const maxDistanceSq = this.budget.maxDistancePc === Infinity ? Infinity : this.budget.maxDistancePc ** 2;
    for (const star of this.stars.values()) {
      if (this.residentIds && !this.residentIds.has(star.id)) continue;
      const p = star.positionPc;
      const dx = p.x - this.originPc.x; const dy = p.y - this.originPc.y; const dz = p.z - this.originPc.z;
      if (dx * dx + dy * dy + dz * dz > maxDistanceSq) continue;
      const magnitude = Number(star.magnitude);
      if (Number.isFinite(magnitude) && magnitude > this.budget.maxMagnitude) continue;
      selected.push(star);
    }
    selected.sort((a, b) => (Number.isFinite(Number(a.magnitude)) ? Number(a.magnitude) : 99) - (Number.isFinite(Number(b.magnitude)) ? Number(b.magnitude) : 99));
    this.truncatedStars = Math.max(0, selected.length - this.budget.maxStars);
    return selected.slice(0, this.budget.maxStars);
  }

  #ensureCapacity(required) {
    if (required <= this.capacity) return;
    let capacity = Math.max(256, this.capacity || 0);
    while (capacity < required) capacity = Math.min(this.budget.maxStars, capacity * 2);
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    const PositionAttribute = this.THREE.BufferAttribute || this.THREE.Float32BufferAttribute;
    this.positionAttribute = new PositionAttribute(this.positions, 3);
    this.colorAttribute = new PositionAttribute(this.colors, 3);
    if (this.THREE.DynamicDrawUsage !== undefined) {
      this.positionAttribute.setUsage?.(this.THREE.DynamicDrawUsage);
      this.colorAttribute.setUsage?.(this.THREE.DynamicDrawUsage);
    }
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);
  }

  #writeBuffers(stars) {
    this.#ensureCapacity(stars.length);
    const color = new this.THREE.Color();
    let offset = 0;
    for (const star of stars) {
      const p = star.positionPc;
      this.positions[offset] = (p.x - this.originPc.x) * this.scale;
      this.positions[offset + 1] = (p.z - this.originPc.z) * this.scale;
      this.positions[offset + 2] = -(p.y - this.originPc.y) * this.scale;
      const bpRp = Number(star.colorIndex);
      const hue = Number.isFinite(bpRp) ? Math.max(0.02, Math.min(0.68, 0.67 - bpRp * 0.16)) : 0.58;
      color.setHSL(hue, 0.72, 0.72);
      this.colors[offset] = color.r; this.colors[offset + 1] = color.g; this.colors[offset + 2] = color.b;
      offset += 3;
    }
    if (this.positionAttribute) this.positionAttribute.needsUpdate = true;
    if (this.colorAttribute) this.colorAttribute.needsUpdate = true;
    this.geometry.setDrawRange?.(0, stars.length);
    this.geometry.computeBoundingSphere?.();
    this.renderedStars = stars.length;
  }

  #rebuild() { this.#writeBuffers(this.#selectStars()); }

  getStats() {
    const residentStars = this.residentIds ? [...this.residentIds].filter((id) => this.stars.has(id)).length : this.stars.size;
    return {
      stars: this.stars.size,
      residentStars,
      renderedStars: this.renderedStars,
      truncatedStars: this.truncatedStars,
      drawCalls: this.renderedStars ? 1 : 0,
      bufferCapacity: this.capacity,
      gpuBufferBytes: this.capacity * 3 * Float32Array.BYTES_PER_ELEMENT * 2,
      budget: { ...this.budget },
      originPc: { ...this.originPc },
    };
  }

  dispose() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.stars.clear();
    this.residentIds = null;
    this.positions = new Float32Array(0);
    this.colors = new Float32Array(0);
    this.capacity = 0;
    this.renderedStars = 0;
  }
}
