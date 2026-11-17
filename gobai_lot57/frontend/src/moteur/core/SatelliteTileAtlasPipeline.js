import { bindSatelliteAtlasEntryToTileUniforms } from './SatelliteAtlasTileBinding.js';
import { validateSatelliteAtlasTileBinding } from './SatelliteSurfaceAtlasDiagnostics.js';

/**
 * Pont opt-in entre TileLayer et un SatelliteMultiLayerTextureAtlasManager.
 * Le chargement classique reste propriétaire des images et sert de repli.
 * Le pipeline ne détruit jamais les textures sources et ne possède pas l'atlas.
 */
export class SatelliteTileAtlasPipeline {
  constructor({ atlas, memoryBudgetBridge = null, maxItemsPerInstall = 1, bodyId = null, diagnostics = null, mode = 'atlas', onError } = {}) {
    if (!atlas || typeof atlas.enqueue !== 'function' || typeof atlas.processQueue !== 'function' || typeof atlas.get !== 'function') {
      throw new TypeError('Un gestionnaire d’atlas multi-couches est requis.');
    }
    if (!Number.isInteger(maxItemsPerInstall) || maxItemsPerInstall < 0) throw new RangeError('maxItemsPerInstall doit être un entier positif ou nul.');
    if (memoryBudgetBridge && (typeof memoryBudgetBridge.retainEntry !== 'function' || typeof memoryBudgetBridge.releaseEntry !== 'function')) {
      throw new TypeError('memoryBudgetBridge doit exposer retainEntry() et releaseEntry().');
    }
    if (bodyId !== null && (typeof bodyId !== 'string' || !bodyId.trim())) throw new TypeError('bodyId doit être une chaîne non vide ou null.');
    if (!['atlas', 'classic'].includes(mode)) throw new TypeError('mode doit être atlas ou classic.');
    this.atlas = atlas;
    this.mode = mode;
    if (diagnostics && typeof diagnostics.recordTileAttach !== 'function') throw new TypeError('diagnostics doit exposer recordTileAttach().');
    this.bodyId = bodyId;
    this.diagnostics = diagnostics;
    this.memoryBudgetBridge = memoryBudgetBridge;
    this.maxItemsPerInstall = maxItemsPerInstall;
    this.onError = typeof onError === 'function' ? onError : null;
    this.attached = new Set();
    // Uniforms + valeurs classiques conservés pour permettre un basculement à chaud sans reconstruire la scène.
    this.bindings = new Map();
    this.disposed = false;
  }

  /** Mode d'affichage courant : atlas ou texture classique. */
  getMode() { return this.mode; }

  /**
   * Bascule à chaud les tuiles déjà raccordées. Les entrées atlas restent retenues
   * pendant le mode classique afin que le retour en mode atlas ne recharge rien.
   */
  setMode(mode) {
    if (this.disposed) throw new Error('Pipeline atlas déjà libéré.');
    if (!['atlas', 'classic'].includes(mode)) throw new TypeError('mode doit être atlas ou classic.');
    if (mode === this.mode) return { mode, changed: 0, fallback: 0 };
    let changed = 0;
    let fallback = 0;
    for (const [id, binding] of this.bindings) {
      if (mode === 'classic') {
        this.#restoreClassic(binding);
        changed += 1;
        continue;
      }
      const entry = this.atlas.get(id);
      if (!entry || entry.status !== 'ready') {
        this.#restoreClassic(binding);
        fallback += 1;
        continue;
      }
      try {
        bindSatelliteAtlasEntryToTileUniforms(entry, binding.uniforms, { tileRect: binding.tileRect });
        const validation = validateSatelliteAtlasTileBinding(entry, binding.uniforms);
        this.diagnostics?.recordTileAttach({ id, bodyId: binding.bodyId, status: 'attached', validation });
        changed += 1;
      } catch (error) {
        this.#restoreClassic(binding);
        fallback += 1;
        this.onError?.(error, id);
      }
    }
    this.mode = mode;
    return { mode, changed, fallback };
  }

  #restoreClassic(binding) {
    const { uniforms, classicTexture, classicRect } = binding;
    if (uniforms?.map && 'value' in uniforms.map) uniforms.map.value = classicTexture;
    if (uniforms?.baseRect && 'value' in uniforms.baseRect) {
      const target = uniforms.baseRect.value;
      if (target && typeof target.set === 'function') target.set(...classicRect);
      else uniforms.baseRect.value = new Float32Array(classicRect);
    }
  }

  attach({ id, image, uniforms, tileRect, bodyId = this.bodyId }) {
    if (this.disposed) throw new Error('Pipeline atlas déjà libéré.');
    if (typeof id !== 'string' || !id || !image || !uniforms) throw new TypeError('id, image et uniforms sont requis.');
    if (this.attached.has(id)) {
      const entry = this.atlas.get(id);
      this.diagnostics?.recordTileAttach({ id, bodyId, status: 'already-attached' });
      return { status: 'already-attached', entry };
    }
    const startedAt = globalThis.performance?.now?.() ?? Date.now();
    const classicTexture = uniforms.map?.value ?? null;
    const rectValue = uniforms.baseRect?.value;
    const classicRect = rectValue && typeof rectValue.toArray === 'function'
      ? rectValue.toArray().slice(0, 4).map(Number)
      : rectValue && typeof rectValue.x === 'number'
        ? [rectValue.x, rectValue.y, rectValue.z, rectValue.w].map(Number)
        : Array.isArray(rectValue) || ArrayBuffer.isView(rectValue)
          ? Array.from(rectValue).slice(0, 4).map(Number)
          : [0, 0, 1, 1];
    const record = (status, reason = null, validation = null) => this.diagnostics?.recordTileAttach({
      id, bodyId, status, reason, validation,
      durationMs: Math.max(0, (globalThis.performance?.now?.() ?? Date.now()) - startedAt),
      sourceWidth: Number(image.naturalWidth || image.videoWidth || image.width) || null,
      sourceHeight: Number(image.naturalHeight || image.videoHeight || image.height) || null,
    });
    const width = Number(image.naturalWidth || image.videoWidth || image.width);
    const height = Number(image.naturalHeight || image.videoHeight || image.height);
    if (!(width > 0 && height > 0)) { record('fallback', 'invalid-image-size'); return { status: 'fallback', reason: 'invalid-image-size' }; }
    let retained = false;
    try {
      this.atlas.enqueue({ id, width, height, layers: { color: image }, priority: 0, bodyId, metadata: { source: 'TileLayer', bodyId } });
      this.atlas.processQueue(this.maxItemsPerInstall);
      const entry = this.atlas.get(id);
      if (!entry) {
        // Ne conserve pas une référence à l'image source si l'atlas est plein :
        // TileLayer garde alors son chemin texture classique.
        this.atlas.cancelQueued?.(id);
        record('fallback', 'atlas-capacity');
        return { status: 'fallback', reason: 'atlas-capacity', entry: null };
      }
      retained = this.memoryBudgetBridge
        ? this.memoryBudgetBridge.retainEntry(id)
        : (this.atlas.retain?.(id) ?? true);
      if (!retained) {
        this.atlas.release?.(id);
        record('fallback', 'gpu-budget-rejected');
        return { status: 'fallback', reason: 'gpu-budget-rejected' };
      }
      const binding = { uniforms, classicTexture, classicRect, tileRect, bodyId };
      this.bindings.set(id, binding);
      this.attached.add(id);
      if (this.mode === 'classic') {
        this.#restoreClassic(binding);
        record('attached');
        return { status: 'attached', entry, result: { applied: [], pending: Object.keys(entry.textures || {}) }, validation: null, mode: this.mode };
      }
      const result = bindSatelliteAtlasEntryToTileUniforms(entry, uniforms, { tileRect });
      const validation = validateSatelliteAtlasTileBinding(entry, uniforms);
      record('attached', null, validation);
      return { status: 'attached', entry, result, validation, mode: this.mode };
    } catch (error) {
      this.#restoreClassic({ uniforms, classicTexture, classicRect });
      this.bindings.delete(id);
      this.attached.delete(id);
      if (retained) {
        if (this.memoryBudgetBridge) this.memoryBudgetBridge.releaseEntry(id);
        else this.atlas.release?.(id);
      } else {
        this.atlas.release?.(id);
      }
      this.onError?.(error, id);
      record('fallback', 'atlas-error');
      return { status: 'fallback', reason: 'atlas-error', error };
    }
  }

  release(id) {
    const binding = this.bindings.get(id);
    if (binding) this.#restoreClassic(binding);
    this.bindings.delete(id);
    this.attached.delete(id);
    this.diagnostics?.recordTileRelease({ id, bodyId: binding?.bodyId ?? this.bodyId });
    return this.memoryBudgetBridge
      ? this.memoryBudgetBridge.releaseEntry(id)
      : (this.atlas.release?.(id) ?? false);
  }

  dispose() {
    if (this.disposed) return;
    for (const id of this.attached) {
      const binding = this.bindings.get(id);
      if (binding) this.#restoreClassic(binding);
      if (this.memoryBudgetBridge) this.memoryBudgetBridge.releaseEntry(id);
      else this.atlas.release?.(id);
      this.diagnostics?.recordTileRelease({ id, bodyId: this.bodyId });
    }
    this.attached.clear();
    this.bindings.clear();
    this.disposed = true;
  }
}
