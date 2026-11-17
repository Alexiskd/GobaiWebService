const DEFAULT_LIMITS = Object.freeze({ maxMeanAbsoluteDifference: 1.5, maxChangedPixelRatio: 0.01 });

function normalizeFrame(frame, label) {
  const width = Number(frame?.width);
  const height = Number(frame?.height);
  const data = frame?.data;
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
    throw new TypeError(`${label}: largeur et hauteur d'image invalides.`);
  }
  if (!data || typeof data.length !== 'number' || data.length !== width * height * 4) {
    throw new TypeError(`${label}: données RGBA incompatibles avec les dimensions.`);
  }
  return { width, height, data };
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

/** Compare deux captures RGBA de cadrage identique. Les buffers restent détenus par l'appelant. */
export function compareSatelliteAtlasVisualFrames(classicFrame, atlasFrame, {
  pixelThreshold = 2,
  limits = DEFAULT_LIMITS,
} = {}) {
  const classic = normalizeFrame(classicFrame, 'classicFrame');
  const atlas = normalizeFrame(atlasFrame, 'atlasFrame');
  if (classic.width !== atlas.width || classic.height !== atlas.height) {
    throw new RangeError('Les captures classique et atlas doivent avoir les mêmes dimensions.');
  }
  if (!Number.isFinite(pixelThreshold) || pixelThreshold < 0) throw new RangeError('pixelThreshold doit être positif ou nul.');
  const maxMean = Number(limits.maxMeanAbsoluteDifference);
  const maxChanged = Number(limits.maxChangedPixelRatio);
  if (!Number.isFinite(maxMean) || maxMean < 0 || !Number.isFinite(maxChanged) || maxChanged < 0 || maxChanged > 1) {
    throw new RangeError('Limites visuelles invalides.');
  }

  const pixelCount = classic.width * classic.height;
  let totalAbsoluteDifference = 0;
  let changedPixels = 0;
  let maximumChannelDifference = 0;
  const channelAbsoluteDifference = [0, 0, 0, 0];
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    let pixelMaximum = 0;
    for (let channel = 0; channel < 4; channel += 1) {
      const difference = Math.abs(Number(classic.data[offset + channel]) - Number(atlas.data[offset + channel]));
      channelAbsoluteDifference[channel] += difference;
      totalAbsoluteDifference += difference;
      pixelMaximum = Math.max(pixelMaximum, difference);
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
    }
    if (pixelMaximum > pixelThreshold) changedPixels += 1;
  }
  const meanAbsoluteDifference = totalAbsoluteDifference / (pixelCount * 4);
  const changedPixelRatio = changedPixels / pixelCount;
  return Object.freeze({
    width: classic.width,
    height: classic.height,
    pixelCount,
    meanAbsoluteDifference,
    channelMeanAbsoluteDifference: Object.freeze(channelAbsoluteDifference.map((value) => value / pixelCount)),
    maximumChannelDifference,
    changedPixels,
    changedPixelRatio,
    pixelThreshold,
    limits: Object.freeze({ maxMeanAbsoluteDifference: maxMean, maxChangedPixelRatio: maxChanged }),
    passed: meanAbsoluteDifference <= maxMean && changedPixelRatio <= maxChanged,
  });
}

/** Mesure les ruptures de luminance le long de frontières de tuiles connues. */
export function analyzeSatelliteAtlasTileBoundaries(frame, { vertical = [], horizontal = [] } = {}) {
  const image = normalizeFrame(frame, 'frame');
  const measure = (orientation, coordinates) => coordinates.map((coordinate) => {
    const position = Number(coordinate);
    const max = orientation === 'vertical' ? image.width : image.height;
    if (!Number.isInteger(position) || position <= 0 || position >= max) throw new RangeError(`Frontière ${orientation} hors image: ${coordinate}`);
    let total = 0;
    let count = 0;
    const length = orientation === 'vertical' ? image.height : image.width;
    for (let along = 0; along < length; along += 1) {
      const left = orientation === 'vertical' ? (along * image.width + position - 1) * 4 : ((position - 1) * image.width + along) * 4;
      const right = orientation === 'vertical' ? left + 4 : left + image.width * 4;
      // Différence de luminance RGB ; alpha est ignoré pour l'analyse des coutures.
      const lumA = image.data[left] * 0.2126 + image.data[left + 1] * 0.7152 + image.data[left + 2] * 0.0722;
      const lumB = image.data[right] * 0.2126 + image.data[right + 1] * 0.7152 + image.data[right + 2] * 0.0722;
      total += Math.abs(lumA - lumB);
      count += 1;
    }
    return Object.freeze({ position, meanLuminanceStep: count ? total / count : 0, samples: count });
  });
  const verticalResults = measure('vertical', vertical);
  const horizontalResults = measure('horizontal', horizontal);
  const all = [...verticalResults, ...horizontalResults];
  return Object.freeze({
    vertical: Object.freeze(verticalResults),
    horizontal: Object.freeze(horizontalResults),
    meanBoundaryLuminanceStep: mean(all.map((item) => item.meanLuminanceStep)),
    boundaryCount: all.length,
    note: 'Une rupture élevée n’est pas automatiquement un défaut : comparer les mêmes frontières sur la capture classique de référence.',
  });
}

/**
 * Banc A/B injecté : l'application fournit le cadrage et la capture RGBA (ex. readPixels).
 * Le mode initial est toujours restauré, y compris en cas d'échec d'une capture.
 */
export class SatelliteAtlasVisualValidationRunner {
  constructor({ getMode, setMode, setView, captureFrame, scenarios, limits, boundaryProvider = null } = {}) {
    if (typeof getMode !== 'function' || typeof setMode !== 'function' || typeof setView !== 'function' || typeof captureFrame !== 'function') {
      throw new TypeError('getMode, setMode, setView et captureFrame sont requis.');
    }
    if (!Array.isArray(scenarios) || !scenarios.length) throw new TypeError('Au moins un scénario de capture est requis.');
    for (const scenario of scenarios) {
      if (!scenario || typeof scenario.bodyId !== 'string' || !scenario.bodyId || typeof scenario.viewKey !== 'string' || !scenario.viewKey) {
        throw new TypeError('Chaque scénario doit définir bodyId et viewKey.');
      }
    }
    this.getMode = getMode;
    this.setMode = setMode;
    this.setView = setView;
    this.captureFrame = captureFrame;
    this.scenarios = scenarios.map((scenario) => ({ ...scenario }));
    this.limits = limits || DEFAULT_LIMITS;
    this.boundaryProvider = boundaryProvider;
    this.running = false;
  }

  async run() {
    if (this.running) throw new Error('Une validation visuelle est déjà en cours.');
    this.running = true;
    const results = [];
    try {
      for (const scenario of this.scenarios) {
        const originalMode = this.getMode(scenario.bodyId);
        const restoreView = await this.setView(scenario);
        try {
          await this.setMode('classic', scenario.bodyId);
          const classicFrame = normalizeFrame(await this.captureFrame({ ...scenario, mode: 'classic' }), 'classicFrame');
          await this.setMode('atlas', scenario.bodyId);
          const atlasFrame = normalizeFrame(await this.captureFrame({ ...scenario, mode: 'atlas' }), 'atlasFrame');
          const visual = compareSatelliteAtlasVisualFrames(classicFrame, atlasFrame, { limits: this.limits });
          const boundaries = this.boundaryProvider ? this.boundaryProvider(scenario) : { vertical: [], horizontal: [] };
          const classicSeams = analyzeSatelliteAtlasTileBoundaries(classicFrame, boundaries);
          const atlasSeams = analyzeSatelliteAtlasTileBoundaries(atlasFrame, boundaries);
          results.push(Object.freeze({
            bodyId: scenario.bodyId,
            viewKey: scenario.viewKey,
            visual,
            seams: Object.freeze({ classic: classicSeams, atlas: atlasSeams, deltaMeanLuminanceStep: atlasSeams.meanBoundaryLuminanceStep - classicSeams.meanBoundaryLuminanceStep }),
            passed: visual.passed,
          }));
        } finally {
          try { if (typeof restoreView === 'function') await restoreView(); }
          finally { await this.setMode(originalMode, scenario.bodyId); }
        }
      }
      return Object.freeze({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        scenarioCount: results.length,
        passed: results.every((result) => result.passed),
        results: Object.freeze(results),
        methodology: 'Captures séquentielles classique puis atlas ; même scénario et même cadrage demandé ; comparaison pixel RGBA et rupture de luminance aux frontières fournies.',
        limitations: ['La synchronisation exacte de la caméra, du temps orbital, de l’éclairage et du chargement des tuiles relève du callback setView.', 'La lecture de pixels doit être fournie par captureFrame ; aucun navigateur ni GPU n’est piloté par ce module.', 'Une différence pixel élevée peut provenir du rendu non déterministe ou d’un état de scène différent.'],
      });
    } finally {
      this.running = false;
    }
  }
}

export function serializeSatelliteAtlasVisualReport(report, space = 2) {
  if (!report || !Array.isArray(report.results)) throw new TypeError('Rapport de validation visuelle invalide.');
  return JSON.stringify(report, null, space);
}
