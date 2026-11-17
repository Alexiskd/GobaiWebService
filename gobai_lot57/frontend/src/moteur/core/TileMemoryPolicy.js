import { LOAD_STATE } from './PerivolumeManager.js';

/** Profils mémoire réversibles pour les caches de tuiles GPU/RAM. */
export class TileMemoryPolicy {
  constructor({ backgroundGpuRatio = 0.35, backgroundRamRatio = 0.25, minGpu = 48 } = {}) {
    for (const [name, value] of Object.entries({ backgroundGpuRatio, backgroundRamRatio })) {
      if (!Number.isFinite(value) || value < 0 || value > 1) throw new RangeError(`${name} doit être compris entre 0 et 1.`);
    }
    if (!Number.isInteger(minGpu) || minGpu < 1) throw new RangeError('minGpu doit être un entier positif.');
    this.backgroundGpuRatio = backgroundGpuRatio;
    this.backgroundRamRatio = backgroundRamRatio;
    this.minGpu = minGpu;
  }

  profile(state, { gpuBase = 0, ramBase = 0, wantedCount = 0 } = {}) {
    const gpu = Math.max(0, Math.floor(Number(gpuBase) || 0));
    const ram = Math.max(0, Math.floor(Number(ramBase) || 0));
    const wanted = Math.max(0, Math.floor(Number(wantedCount) || 0));
    if (state === LOAD_STATE.ACTIVE) return { gpuCapacity: gpu, ramCapacity: ram, preserveWanted: true };
    if (state === LOAD_STATE.BACKGROUND) return {
      gpuCapacity: Math.max(this.minGpu, Math.floor(gpu * this.backgroundGpuRatio), Math.ceil(wanted * 1.3)),
      ramCapacity: Math.floor(ram * this.backgroundRamRatio),
      preserveWanted: true,
    };
    return { gpuCapacity: Math.max(1, wanted), ramCapacity: 0, preserveWanted: true };
  }
}
