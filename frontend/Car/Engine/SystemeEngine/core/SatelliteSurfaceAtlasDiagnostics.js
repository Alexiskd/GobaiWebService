const DEFAULT_FRAME_LIMIT = 120;
const DEFAULT_TILE_LIMIT = 1000;

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readRect(value) {
  if (!value) return null;
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return Array.from(value).slice(0, 4).map(Number);
  if (typeof value.x === 'number') return [value.x, value.y, value.z, value.w];
  return null;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

/**
 * Validation structurelle des bindings atlas du shader TileLayer.
 * Ne lit pas les pixels rendus et ne remplace pas une validation visuelle WebGL.
 */
export function validateSatelliteAtlasTileBinding(entry, uniforms, { tolerance = 1e-5 } = {}) {
  if (!entry || entry.status !== 'ready' || !entry.textures || !uniforms) {
    return Object.freeze({ ok: false, checks: Object.freeze({ ready: false, texture: false, rect: false, bounds: false }) });
  }
  const expected = Array.from(entry.uv || [], Number);
  const actual = readRect(uniforms.baseRect?.value);
  const textureOk = Boolean(entry.textures.color && uniforms.map?.value === entry.textures.color);
  const rectOk = expected.length === 4 && actual?.length === 4
    && expected.every((value, index) => Number.isFinite(value) && Number.isFinite(actual[index]) && Math.abs(value - actual[index]) <= tolerance);
  const boundsOk = expected.length === 4 && expected.every(Number.isFinite)
    && expected[0] >= 0 && expected[1] >= 0
    && expected[2] > 0 && expected[3] > 0
    && expected[0] + expected[2] <= 1 + tolerance
    && expected[1] + expected[3] <= 1 + tolerance;
  const checks = Object.freeze({ ready: true, texture: textureOk, rect: rectOk, bounds: boundsOk });
  return Object.freeze({ ok: Object.values(checks).every(Boolean), checks, expectedRect: expected, actualRect: actual });
}

/**
 * Diagnostics expérimentales du pipeline atlas : attaches, replis, validations
 * structurelles et échantillons PerfProbe / renderer.info globaux à la scène.
 * Les mesures Three.js ne sont pas attribuées individuellement à un astre.
 */
export class SatelliteSurfaceAtlasDiagnostics {
  constructor({ maxFrames = DEFAULT_FRAME_LIMIT, maxTiles = DEFAULT_TILE_LIMIT } = {}) {
    if (!Number.isInteger(maxFrames) || maxFrames < 1) throw new RangeError('maxFrames doit être un entier positif.');
    if (!Number.isInteger(maxTiles) || maxTiles < 1) throw new RangeError('maxTiles doit être un entier positif.');
    this.maxFrames = maxFrames;
    this.maxTiles = maxTiles;
    this.frames = [];
    this.tiles = new Map();
    this.counts = { attached: 0, fallback: 0, released: 0, validationPassed: 0, validationFailed: 0 };
    this.byBody = new Map();
    this.disposed = false;
  }

  recordTileAttach({ id, bodyId = null, status, reason = null, durationMs = null, sourceWidth = null, sourceHeight = null, validation = null } = {}) {
    this.#assertAlive();
    if (typeof id !== 'string' || !id) throw new TypeError('id de tuile requis pour les diagnostics.');
    if (!['attached', 'fallback', 'already-attached'].includes(status)) throw new TypeError('Statut d’attache atlas inconnu.');
    const record = Object.freeze({
      id, bodyId, status, reason,
      durationMs: finite(durationMs),
      sourceWidth: finite(sourceWidth), sourceHeight: finite(sourceHeight),
      validation: validation ? { ...validation, checks: validation.checks ? { ...validation.checks } : null } : null,
    });
    this.tiles.delete(id);
    this.tiles.set(id, record);
    while (this.tiles.size > this.maxTiles) this.tiles.delete(this.tiles.keys().next().value);
    const body = this.#body(bodyId);
    if (status === 'attached') {
      this.counts.attached += 1;
      body.attached += 1;
      if (validation?.ok) { this.counts.validationPassed += 1; body.validationPassed += 1; }
      else if (validation) { this.counts.validationFailed += 1; body.validationFailed += 1; }
    } else if (status === 'fallback') {
      this.counts.fallback += 1;
      body.fallback += 1;
      body.fallbackReasons[reason || 'unknown'] = (body.fallbackReasons[reason || 'unknown'] || 0) + 1;
    }
    return record;
  }

  recordTileRelease({ id, bodyId = null } = {}) {
    this.#assertAlive();
    const existing = this.tiles.get(id);
    this.tiles.delete(id);
    this.counts.released += 1;
    this.#body(bodyId ?? existing?.bodyId).released += 1;
    return Boolean(existing);
  }

  /** Vide uniquement la fenêtre de mesures, sans effacer les compteurs de tuiles. */
  clearFrameSamples() {
    this.#assertAlive();
    const cleared = this.frames.length;
    this.frames.length = 0;
    return cleared;
  }

  /** perf vient de PerfProbe.frameEnd(); les compteurs renderer.info sont globaux. */
  recordFrame({ perf = null, timestamp = null, mode = 'mixed-scene-atlas-experimental' } = {}) {
    this.#assertAlive();
    const source = perf || {};
    const sample = Object.freeze({
      timestamp: finite(timestamp), mode,
      cpuMs: finite(source.cpuMs), gpuMs: finite(source.gpuMs),
      calls: finite(source.calls), triangles: finite(source.triangles),
      textures: finite(source.textures), geometries: finite(source.geometries),
      heapMb: finite(source.heapMb),
    });
    this.frames.push(sample);
    if (this.frames.length > this.maxFrames) this.frames.shift();
    return sample;
  }

  /** Compare deux fenêtres explicitement étiquetées ; aucun mode A/B n'est activé automatiquement. */
  compareModes(modeA, modeB) {
    this.#assertAlive();
    const summarize = (mode) => {
      const rows = this.frames.filter((frame) => frame.mode === mode);
      const metric = (key) => {
        const values = rows.map((row) => row[key]).filter((value) => value !== null);
        return values.length ? Object.freeze({ count: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) }) : null;
      };
      return Object.freeze({ sampleCount: rows.length, cpuMs: metric('cpuMs'), gpuMs: metric('gpuMs'), calls: metric('calls'), triangles: metric('triangles'), textures: metric('textures'), geometries: metric('geometries') });
    };
    const a = summarize(modeA); const b = summarize(modeB);
    const delta = (key) => a[key]?.mean !== null && a[key]?.mean !== undefined && b[key]?.mean !== null && b[key]?.mean !== undefined
      ? b[key].mean - a[key].mean : null;
    return Object.freeze({ modeA, modeB, a, b, deltaBMinusA: Object.freeze({ cpuMs: delta('cpuMs'), gpuMs: delta('gpuMs'), calls: delta('calls'), triangles: delta('triangles'), textures: delta('textures'), geometries: delta('geometries') }), comparable: a.sampleCount > 0 && b.sampleCount > 0 });
  }

  snapshot() {
    this.#assertAlive();
    const bodies = Object.fromEntries([...this.byBody].map(([id, value]) => [id, { ...value, fallbackReasons: { ...value.fallbackReasons } }]));
    return Object.freeze({
      counts: Object.freeze({ ...this.counts }),
      trackedTiles: this.tiles.size,
      recentTiles: Object.freeze([...this.tiles.values()].map((tile) => ({ ...tile }))),
      byBody: Object.freeze(bodies),
      frameSamples: this.frames.length,
      latestFrame: this.frames.at(-1) || null,
      measurementScope: 'renderer.info et PerfProbe sont des mesures globales de scène, non attribuables individuellement à Terre ou Lune',
      visualPixelValidation: false,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.frames.length = 0;
    this.tiles.clear();
    this.byBody.clear();
    this.disposed = true;
  }

  #body(bodyId) {
    const id = typeof bodyId === 'string' && bodyId ? bodyId : 'unknown';
    if (!this.byBody.has(id)) this.byBody.set(id, { attached: 0, fallback: 0, released: 0, validationPassed: 0, validationFailed: 0, fallbackReasons: {} });
    return this.byBody.get(id);
  }

  #assertAlive() { if (this.disposed) throw new Error('SatelliteSurfaceAtlasDiagnostics est déjà libéré.'); }
}
