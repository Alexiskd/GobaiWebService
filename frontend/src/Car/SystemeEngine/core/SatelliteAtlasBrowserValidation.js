import { SatelliteAtlasVisualValidationRunner, serializeSatelliteAtlasVisualReport } from './SatelliteAtlasVisualValidation.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function nextFrame(requestFrame) {
  return new Promise((resolve) => requestFrame(() => resolve()));
}

function snapshotEngineView(engine) {
  return {
    speed: engine.speed,
    simMs: engine.simMs,
    autoRotate: engine.autoRotate,
    az: engine.az,
    el: engine.el,
    dist: engine.dist,
    distGoal: engine.distGoal,
    target: engine.target?.clone?.() ?? null,
    targetStart: engine.targetStart?.clone?.() ?? null,
    focus: engine.focus,
    focusT: engine.focusT,
    zoomFlight: engine.zoomFlight,
    viewLock: engine.viewLock,
    lockCity: engine.lockCity,
    drag: engine.drag,
  };
}

function restoreEngineView(engine, snapshot) {
  Object.assign(engine, {
    speed: snapshot.speed,
    simMs: snapshot.simMs,
    autoRotate: snapshot.autoRotate,
    az: snapshot.az,
    el: snapshot.el,
    dist: snapshot.dist,
    distGoal: snapshot.distGoal,
    focus: snapshot.focus,
    focusT: snapshot.focusT,
    zoomFlight: snapshot.zoomFlight,
    viewLock: snapshot.viewLock,
    lockCity: snapshot.lockCity,
    drag: snapshot.drag,
  });
  if (snapshot.target && engine.target?.copy) engine.target.copy(snapshot.target);
  if (snapshot.targetStart && engine.targetStart?.copy) engine.targetStart.copy(snapshot.targetStart);
}

/** Adaptateur navigateur pour piloter les captures réelles du canvas WebGL de SolarEngine. */
export class SatelliteAtlasBrowserValidationAdapter {
  constructor(engine, {
    documentRef = globalThis.document,
    requestFrame = globalThis.requestAnimationFrame,
    frameCount = 3,
    waitUntilReady = null,
    readyTimeoutMs = 15000,
  } = {}) {
    if (!engine?.renderer?.domElement || typeof engine.setSurfaceAtlasMode !== 'function') {
      throw new TypeError('Un SolarEngine initialisé avec renderer et setSurfaceAtlasMode est requis.');
    }
    if (!documentRef?.createElement || typeof requestFrame !== 'function') {
      throw new TypeError('Un document et requestAnimationFrame de navigateur sont requis.');
    }
    if (!Number.isInteger(frameCount) || frameCount < 1) throw new RangeError('frameCount doit être un entier positif.');
    this.engine = engine;
    this.document = documentRef;
    this.requestFrame = requestFrame;
    this.frameCount = frameCount;
    this.waitUntilReady = waitUntilReady;
    this.readyTimeoutMs = readyTimeoutMs;
    this.captures = new Map();
    this.activeViewSnapshot = null;
  }

  getMode(bodyId) {
    return this.engine.surfaceAtlasRuntimes?.get(bodyId)?.pipeline?.getMode?.() ?? 'classic';
  }

  setMode(mode, bodyId) {
    const result = this.engine.setSurfaceAtlasMode(mode, bodyId);
    if (!result?.ok) throw new Error(`Impossible d'activer le mode ${mode} pour ${bodyId}: ${result?.reason || 'erreur inconnue'}`);
    return result;
  }

  async setView(scenario) {
    if (this.activeViewSnapshot) throw new Error('Une vue de validation est déjà verrouillée.');
    const engine = this.engine;
    this.activeViewSnapshot = snapshotEngineView(engine);
    engine.speed = 0;
    engine.autoRotate = false;
    engine.drag = false;
    engine.zoomFlight = null;
    engine.viewLock = null;
    engine.lockCity = null;
    if (engine.keyRotate) Object.keys(engine.keyRotate).forEach((key) => { engine.keyRotate[key] = false; });
    engine.focusT = 1;
    const view = scenario.cameraState || scenario.view || null;
    const bodyFocus = engine.focusTargets?.findIndex((target) => target.tiled?.id === scenario.bodyId) ?? -1;
    if (view && Number.isInteger(view.focusIndex)) engine.focus = view.focusIndex;
    else if (bodyFocus >= 0) engine.focus = bodyFocus;
    if (engine.focusTarget?.()?.get && engine.targetStart?.copy) {
      engine.targetStart.copy(engine.focusTarget().get());
      engine.target.copy(engine.focusTarget().get());
    }
    if (view) {
      if (Number.isFinite(view.az)) engine.az = view.az;
      if (Number.isFinite(view.el)) engine.el = view.el;
      if (Number.isFinite(view.dist)) engine.dist = view.dist;
      if (Number.isFinite(view.distGoal)) engine.distGoal = view.distGoal;
    }
    try {
      await this.waitFrames(this.frameCount);
      if (this.waitUntilReady) await this.waitUntilReady({ engine, scenario, timeoutMs: this.readyTimeoutMs });
    } catch (error) {
      restoreEngineView(engine, this.activeViewSnapshot);
      this.activeViewSnapshot = null;
      throw error;
    }
    let restored = false;
    return async () => {
      if (restored) return;
      restored = true;
      restoreEngineView(engine, this.activeViewSnapshot);
      this.activeViewSnapshot = null;
      await this.waitFrames(1);
    };
  }

  async waitFrames(count) {
    for (let index = 0; index < count; index += 1) await nextFrame(this.requestFrame);
  }

  async captureFrame({ bodyId, viewKey, mode }) {
    if (this.waitUntilReady) await this.waitUntilReady({ engine: this.engine, scenario: { bodyId, viewKey }, mode, timeoutMs: this.readyTimeoutMs });
    await this.waitFrames(this.frameCount);
    const source = this.engine.renderer.domElement;
    const width = source.width;
    const height = source.height;
    if (!width || !height) throw new Error('Le canvas WebGL ne possède pas de dimensions de capture valides.');
    const canvas = this.document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Impossible de créer le contexte 2D temporaire pour lire la capture WebGL.');
    try {
      context.drawImage(source, 0, 0, width, height);
      const image = context.getImageData(0, 0, width, height);
      const frame = { width, height, data: image.data };
      const dataUrl = canvas.toDataURL('image/png');
      this.captures.set(`${bodyId}:${viewKey}:${mode}`, { ...frame, dataUrl });
      return frame;
    } catch (error) {
      throw new Error(`Lecture de la capture WebGL impossible (canvas potentiellement non lisible/CORS): ${error.message}`, { cause: error });
    }
  }

  createRunner({ scenarios, limits, boundaryProvider = null } = {}) {
    return new SatelliteAtlasVisualValidationRunner({
      getMode: (bodyId) => this.getMode(bodyId),
      setMode: (mode, bodyId) => this.setMode(mode, bodyId),
      setView: (scenario) => this.setView(scenario),
      captureFrame: (capture) => this.captureFrame(capture),
      scenarios,
      limits,
      boundaryProvider,
    });
  }

  buildHtmlReport(report) {
    if (!report?.results) throw new TypeError('Rapport de validation visuelle invalide.');
    const rows = report.results.map((result) => {
      const classic = this.captures.get(`${result.bodyId}:${result.viewKey}:classic`);
      const atlas = this.captures.get(`${result.bodyId}:${result.viewKey}:atlas`);
      const images = [classic, atlas].map((capture, index) => capture?.dataUrl
        ? `<figure><figcaption>${index === 0 ? 'Classique' : 'Atlas'}</figcaption><img src="${capture.dataUrl}" alt="Capture ${index === 0 ? 'classique' : 'atlas'} ${escapeHtml(result.bodyId)}" /></figure>`
        : '').join('');
      return `<section><h2>${escapeHtml(result.bodyId)} — ${escapeHtml(result.viewKey)}</h2><p>Résultat : <strong>${result.passed ? 'CONFORME' : 'À EXAMINER'}</strong> · différence moyenne ${Number(result.visual.meanAbsoluteDifference).toFixed(3)} · pixels modifiés ${(result.visual.changedPixelRatio * 100).toFixed(3)} %</p><div class="captures">${images}</div><details><summary>Mesures détaillées</summary><pre>${escapeHtml(JSON.stringify(result, null, 2))}</pre></details></section>`;
    }).join('\n');
    const json = escapeHtml(serializeSatelliteAtlasVisualReport(report));
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gobai Space — Rapport Atlas A/B</title><style>body{font:15px/1.5 system-ui,sans-serif;max-width:1100px;margin:32px auto;padding:0 20px;color:#202124}header{border-bottom:1px solid #ddd;margin-bottom:24px}section{border:1px solid #ddd;border-radius:12px;padding:18px;margin:18px 0}.captures{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}figure{margin:0}img{width:100%;height:auto;border:1px solid #ddd;border-radius:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:12px;border-radius:8px}.status{font-weight:700}</style></head><body><header><h1>Gobai Space — Validation visuelle Atlas</h1><p>Généré le ${escapeHtml(report.generatedAt)} · ${report.scenarioCount} scénario(s) · <span class="status">${report.passed ? 'CONFORME' : 'À EXAMINER'}</span></p></header>${rows}<details><summary>Rapport JSON complet</summary><pre>${json}</pre></details><p><small>Captures réalisées depuis le canvas WebGL. Le rapport ne remplace pas une inspection visuelle humaine des artefacts fins.</small></p></body></html>`;
  }
}
