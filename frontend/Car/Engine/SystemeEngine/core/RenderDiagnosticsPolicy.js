/**
 * Diagnostics du pipeline Three.js à partir de renderer.info / PerfProbe.
 * Cette classe observe les coûts et formule des signaux ; elle ne modifie jamais
 * les matériaux, géométries, shaders ou objets de la scène.
 */
export class RenderDiagnosticsPolicy {
  constructor({
    calls = { warning: 250, critical: 500 },
    triangles = { warning: 1_500_000, critical: 3_000_000 },
    textures = { warning: 128, critical: 256 },
    geometries = { warning: 1_000, critical: 2_000 },
  } = {}) {
    this.thresholds = { calls, triangles, textures, geometries };
    this.last = null;
  }

  analyze(metrics = {}) {
    const values = {
      calls: metrics.calls,
      triangles: metrics.triangles,
      textures: metrics.textures,
      geometries: metrics.geometries,
    };
    const pressure = {};
    const warnings = [];
    for (const [key, value] of Object.entries(values)) {
      const n = Number(value);
      const valid = value !== null && value !== undefined && value !== '' && Number.isFinite(n) && n >= 0;
      const threshold = this.thresholds[key];
      const level = !valid ? 'unknown' : n >= threshold.critical ? 'critical' : n >= threshold.warning ? 'warning' : 'normal';
      pressure[key] = { value: valid ? n : null, level };
      if (level === 'critical' || level === 'warning') warnings.push({ metric: key, level, value: n });
    }
    const hasCritical = warnings.some((item) => item.level === 'critical');
    const hasWarning = warnings.length > 0;
    this.last = {
      level: hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal',
      pressure,
      warnings,
      recommendations: this.recommendations(pressure),
      measuredAt: Number.isFinite(metrics.timestamp) ? metrics.timestamp : null,
    };
    return this.snapshot();
  }

  recommendations(pressure) {
    const out = [];
    if (pressure.calls?.level !== 'normal' && pressure.calls?.level !== 'unknown') out.push('Réduire les objets rendus séparément et mutualiser les matériaux compatibles.');
    if (pressure.triangles?.level !== 'normal' && pressure.triangles?.level !== 'unknown') out.push('Renforcer le LOD géométrique et simplifier les maillages éloignés.');
    if (pressure.textures?.level !== 'normal' && pressure.textures?.level !== 'unknown') out.push('Auditer les textures résidentes et les résolutions des mipmaps.');
    if (pressure.geometries?.level !== 'normal' && pressure.geometries?.level !== 'unknown') out.push('Auditer les géométries dupliquées et leur cycle de vie.');
    return out;
  }

  snapshot() {
    if (!this.last) return { level: 'unknown', pressure: {}, warnings: [], recommendations: [], measuredAt: null };
    return {
      ...this.last,
      pressure: Object.fromEntries(Object.entries(this.last.pressure).map(([key, value]) => [key, { ...value }])),
      warnings: this.last.warnings.map((item) => ({ ...item })),
      recommendations: [...this.last.recommendations],
    };
  }

  reset() { this.last = null; }
}
