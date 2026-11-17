const AXES = Object.freeze(['x', 'y', 'z']);
const finiteVector = (p) => p && AXES.every((axis) => Number.isFinite(Number(p[axis])));
const squaredDistance = (a, b) => AXES.reduce((sum, axis) => sum + (a[axis] - b[axis]) ** 2, 0);

function buildKDTree(points, depth = 0) {
  if (!points.length) return null;
  const axis = AXES[depth % 3];
  const sorted = [...points].sort((a, b) => a.position[axis] - b.position[axis]);
  const middle = Math.floor(sorted.length / 2);
  return {
    axis,
    point: sorted[middle],
    left: buildKDTree(sorted.slice(0, middle), depth + 1),
    right: buildKDTree(sorted.slice(middle + 1), depth + 1),
  };
}

/** Index KD 3D immuable entre deux reconstructions, adapté aux catalogues galactiques. */
export class GalacticSpatialIndex {
  constructor({ sectorSizePc = 10 } = {}) {
    if (!Number.isFinite(sectorSizePc) || sectorSizePc <= 0) throw new RangeError('sectorSizePc doit être positif.');
    this.sectorSizePc = sectorSizePc;
    this.records = new Map();
    this.sectors = new Map();
    this.root = null;
    this.dirty = false;
  }

  upsert(id, position, metadata = {}) {
    if (typeof id !== 'string' || !id.trim() || !finiteVector(position)) throw new TypeError('Identifiant et position 3D valides requis.');
    const normalized = { x: Number(position.x), y: Number(position.y), z: Number(position.z) };
    const previous = this.records.get(id);
    if (previous) this.#removeFromSector(previous);
    const sector = this.#sectorKey(normalized);
    const record = { id, position: normalized, metadata, sector };
    this.records.set(id, record);
    if (!this.sectors.has(sector)) this.sectors.set(sector, new Set());
    this.sectors.get(sector).add(id);
    this.dirty = true;
    return record;
  }

  remove(id) {
    const record = this.records.get(id);
    if (!record) return false;
    this.#removeFromSector(record);
    this.records.delete(id);
    this.dirty = true;
    return true;
  }

  #removeFromSector(record) {
    const bucket = this.sectors.get(record.sector);
    bucket?.delete(record.id);
    if (bucket?.size === 0) this.sectors.delete(record.sector);
  }

  #sectorKey(position) {
    const size = this.sectorSizePc;
    return `${Math.floor(position.x / size)}:${Math.floor(position.y / size)}:${Math.floor(position.z / size)}`;
  }

  #ensureTree() {
    if (!this.dirty) return;
    this.root = buildKDTree([...this.records.values()]);
    this.dirty = false;
  }

  queryRadius(center, radius, { limit = Infinity } = {}) {
    if (!finiteVector(center) || Number.isNaN(radius) || radius < 0) throw new RangeError('Centre et rayon invalides.');
    if (!(limit === Infinity || (Number.isInteger(limit) && limit >= 0))) throw new RangeError('limit invalide.');
    this.#ensureTree();
    const origin = { x: Number(center.x), y: Number(center.y), z: Number(center.z) };
    const radiusSq = radius * radius;
    const found = [];
    const visit = (node) => {
      if (!node || found.length >= limit) return;
      const delta = node.point.position[node.axis] - origin[node.axis];
      if (squaredDistance(node.point.position, origin) <= radiusSq) {
        found.push({ ...node.point, distance: Math.sqrt(squaredDistance(node.point.position, origin)) });
      }
      const near = delta > 0 ? node.left : node.right;
      const far = delta > 0 ? node.right : node.left;
      visit(near);
      if (Math.abs(delta) <= radius) visit(far);
    };
    visit(this.root);
    found.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
    return Number.isFinite(limit) ? found.slice(0, limit) : found;
  }

  nearest(center, { limit = 1, maxDistance = Infinity } = {}) {
    if (!Number.isInteger(limit) || limit < 0 || !(maxDistance === Infinity || (Number.isFinite(maxDistance) && maxDistance >= 0))) throw new RangeError('Options nearest invalides.');
    if (limit === 0) return [];
    const candidates = this.queryRadius(center, maxDistance);
    return candidates.slice(0, limit);
  }

  querySector(sectorKey) {
    const ids = this.sectors.get(sectorKey);
    return ids ? [...ids].map((id) => this.records.get(id)) : [];
  }

  getSectorKey(position) {
    if (!finiteVector(position)) throw new TypeError('Position 3D invalide.');
    return this.#sectorKey(position);
  }

  getStats() {
    return { objects: this.records.size, sectors: this.sectors.size, sectorSizePc: this.sectorSizePc, indexed: !this.dirty };
  }

  clear() { this.records.clear(); this.sectors.clear(); this.root = null; this.dirty = false; }
}

export function createGalacticSpatialIndex(options) { return new GalacticSpatialIndex(options); }
