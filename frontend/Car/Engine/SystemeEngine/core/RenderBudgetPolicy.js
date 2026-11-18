/**
 * Ajuste le nombre d'astres dont les tuiles sont servies simultanément.
 * La résolution du framebuffer reste pilotée par adaptResolution() dans SolarEngine.
 * Cette politique agit uniquement sur le budget de travail cartographique.
 */
export class RenderBudgetPolicy {
  constructor({
    maxTiledBodies = 3,
    minTiledBodies = 1,
    targetFrameMs = 20,
    downgradeRatio = 1.15,
    upgradeRatio = 0.68,
    downgradeSamples = 2,
    upgradeSamples = 8,
  } = {}) {
    if (!Number.isInteger(maxTiledBodies) || maxTiledBodies < 1) throw new RangeError('maxTiledBodies invalide.');
    if (!Number.isInteger(minTiledBodies) || minTiledBodies < 1 || minTiledBodies > maxTiledBodies) throw new RangeError('minTiledBodies invalide.');
    if (!(targetFrameMs > 0) || !(downgradeRatio > 1) || !(upgradeRatio > 0 && upgradeRatio < 1)) throw new RangeError('Seuils de performance invalides.');
    if (!Number.isInteger(downgradeSamples) || downgradeSamples < 1 || !Number.isInteger(upgradeSamples) || upgradeSamples < 1) throw new RangeError('Fenêtres d’échantillonnage invalides.');
    this.maxTiledBodies = maxTiledBodies;
    this.minTiledBodies = minTiledBodies;
    this.targetFrameMs = targetFrameMs;
    this.downgradeRatio = downgradeRatio;
    this.upgradeRatio = upgradeRatio;
    this.downgradeSamples = downgradeSamples;
    this.upgradeSamples = upgradeSamples;
    this.budget = maxTiledBodies;
    this.overBudgetCount = 0;
    this.headroomCount = 0;
    this.lastMetrics = null;
  }

  update(metrics = {}) {
    const cpuMs = Number(metrics.cpuMs);
    const gpuMs = Number(metrics.gpuMs);
    const validCpu = Number.isFinite(cpuMs) && cpuMs >= 0;
    const validGpu = typeof metrics.gpuMs === 'number' && Number.isFinite(gpuMs) && gpuMs >= 0;
    if (!validCpu && !validGpu) return this.snapshot();

    const loadMs = Math.max(validCpu ? cpuMs : 0, validGpu ? gpuMs : 0);
    const ratio = loadMs / this.targetFrameMs;
    this.lastMetrics = {
      cpuMs: validCpu ? cpuMs : null,
      gpuMs: validGpu ? gpuMs : null,
      calls: Number.isFinite(metrics.calls) ? metrics.calls : null,
      triangles: Number.isFinite(metrics.triangles) ? metrics.triangles : null,
      ratio,
    };

    if (ratio > this.downgradeRatio && this.budget > this.minTiledBodies) {
      this.overBudgetCount += 1;
      this.headroomCount = 0;
      if (this.overBudgetCount >= this.downgradeSamples) {
        this.budget -= 1;
        this.overBudgetCount = 0;
      }
    } else if (ratio < this.upgradeRatio && this.budget < this.maxTiledBodies) {
      this.headroomCount += 1;
      this.overBudgetCount = 0;
      if (this.headroomCount >= this.upgradeSamples) {
        this.budget += 1;
        this.headroomCount = 0;
      }
    } else {
      this.overBudgetCount = 0;
      this.headroomCount = 0;
    }
    return this.snapshot();
  }

  snapshot() {
    return {
      maxTiledBodies: this.budget,
      configuredMaximum: this.maxTiledBodies,
      minimum: this.minTiledBodies,
      overBudgetSamples: this.overBudgetCount,
      headroomSamples: this.headroomCount,
      lastMetrics: this.lastMetrics ? { ...this.lastMetrics } : null,
    };
  }

  reset() {
    this.budget = this.maxTiledBodies;
    this.overBudgetCount = 0;
    this.headroomCount = 0;
    this.lastMetrics = null;
  }
}
