const EPS = 1e-6;

export type FusionPlanes = [Float32Array, Float32Array, Float32Array];

export interface FusionStats {
  mean: number;
  std: number;
}

export interface FusionReference {
  pan: FusionStats;
  intensity: FusionStats;
  rgbMean: [number, number, number];
  pcaVector: [number, number, number];
  pca: FusionStats;
  gramSchmidtGains: [number, number, number];
}

export interface FusionOptions {
  weights?: [number, number, number];
  radius?: number;
  gain?: number;
  proportional?: boolean;
  levels?: number;
  eps?: number;
  reference?: FusionReference;
}

export type FusionAlgorithm = (
  pan: Float32Array,
  ms: FusionPlanes,
  width: number,
  height: number,
  options?: FusionOptions,
) => FusionPlanes;

export function stats(values: Float32Array): FusionStats {
  if (values.length === 0) {
    throw new Error('Impossible de calculer les statistiques d’une image vide.');
  }
  let sum = 0;
  let squaredSum = 0;
  for (let i = 0; i < values.length; i += 1) {
    sum += values[i];
    squaredSum += values[i] * values[i];
  }
  const mean = sum / values.length;
  return {
    mean,
    std: Math.sqrt(Math.max(squaredSum / values.length - mean * mean, EPS * EPS)),
  };
}

export function covariance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) {
    throw new Error('Les plans de fusion doivent avoir la même taille non nulle.');
  }
  let sumA = 0;
  let sumB = 0;
  let productSum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sumA += a[i];
    sumB += b[i];
    productSum += a[i] * b[i];
  }
  return productSum / a.length - (sumA / a.length) * (sumB / a.length);
}

export function correlation(a: Float32Array, b: Float32Array): number {
  const denominator = stats(a).std * stats(b).std;
  return denominator <= EPS ? 0 : covariance(a, b) / denominator;
}

export function matchStats(
  source: Float32Array,
  target: Float32Array,
  sourceReference?: FusionStats,
  targetReference?: FusionStats,
): Float32Array {
  const sourceStats = sourceReference ?? stats(source);
  const targetStats = targetReference ?? stats(target);
  const scale = targetStats.std / sourceStats.std;
  const output = new Float32Array(source.length);
  for (let i = 0; i < source.length; i += 1) {
    output[i] = (source[i] - sourceStats.mean) * scale + targetStats.mean;
  }
  return output;
}

export function intensity(
  ms: FusionPlanes,
  weights: [number, number, number] = [1 / 3, 1 / 3, 1 / 3],
): Float32Array {
  const output = new Float32Array(ms[0].length);
  for (let band = 0; band < ms.length; band += 1) {
    for (let i = 0; i < output.length; i += 1) {
      output[i] += weights[band] * ms[band][i];
    }
  }
  return output;
}

export function subtract(a: Float32Array, b: Float32Array): Float32Array {
  if (a.length !== b.length) {
    throw new Error('Les plans de fusion doivent avoir la même taille.');
  }
  const output = new Float32Array(a.length);
  for (let i = 0; i < output.length; i += 1) output[i] = a[i] - b[i];
  return output;
}

export function inject(
  ms: FusionPlanes,
  delta: Float32Array,
  gains: [number, number, number] = [1, 1, 1],
): FusionPlanes {
  return ms.map((band, channel) => {
    const output = new Float32Array(band.length);
    for (let i = 0; i < output.length; i += 1) {
      output[i] = band[i] + gains[channel] * delta[i];
    }
    return output;
  }) as FusionPlanes;
}

export function injectProportional(
  ms: FusionPlanes,
  delta: Float32Array,
  intensityPlane: Float32Array,
): FusionPlanes {
  return ms.map((band) => {
    const output = new Float32Array(band.length);
    for (let i = 0; i < output.length; i += 1) {
      output[i] =
        band[i] + delta[i] * (band[i] / (intensityPlane[i] + EPS));
    }
    return output;
  }) as FusionPlanes;
}

export function boxBlur(
  source: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  if (radius <= 0) return Float32Array.from(source);
  assertDimensions(source, width, height);
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += source[y * width + x];
      integral[(y + 1) * stride + x + 1] =
        integral[y * stride + x + 1] + rowSum;
    }
  }

  const output = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius) + 1;
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius) + 1;
      output[y * width + x] =
        (integral[y1 * stride + x1] -
          integral[y0 * stride + x1] -
          integral[y1 * stride + x0] +
          integral[y0 * stride + x0]) /
        ((y1 - y0) * (x1 - x0));
    }
  }
  return output;
}

export function smooth(
  source: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  return boxBlur(boxBlur(source, width, height, radius), width, height, radius);
}

export function atrousBlur(
  source: Float32Array,
  width: number,
  height: number,
  step: number,
): Float32Array {
  const kernel = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16];
  const temporary = new Float32Array(width * height);
  const output = new Float32Array(width * height);
  const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(max, value));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) {
        sum += kernel[k + 2] * source[y * width + clamp(x + k * step, width - 1)];
      }
      temporary[y * width + x] = sum;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      for (let k = -2; k <= 2; k += 1) {
        sum +=
          kernel[k + 2] *
          temporary[clamp(y + k * step, height - 1) * width + x];
      }
      output[y * width + x] = sum;
    }
  }
  return output;
}

export function resizeBilinear(
  source: Float32Array,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
): Float32Array {
  assertDimensions(source, width, height);
  const output = new Float32Array(targetWidth * targetHeight);
  const scaleX = width / targetWidth;
  const scaleY = height / targetHeight;
  for (let y = 0; y < targetHeight; y += 1) {
    const fy = Math.max(0, Math.min(height - 1, (y + 0.5) * scaleY - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(y0 + 1, height - 1);
    const ty = fy - y0;
    for (let x = 0; x < targetWidth; x += 1) {
      const fx = Math.max(0, Math.min(width - 1, (x + 0.5) * scaleX - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(x0 + 1, width - 1);
      const tx = fx - x0;
      const top =
        source[y0 * width + x0] * (1 - tx) +
        source[y0 * width + x1] * tx;
      const bottom =
        source[y1 * width + x0] * (1 - tx) +
        source[y1 * width + x1] * tx;
      output[y * targetWidth + x] = top * (1 - ty) + bottom * ty;
    }
  }
  return output;
}

interface PyramidLevel {
  data: Float32Array;
  width: number;
  height: number;
}

export function gaussDown(level: PyramidLevel): PyramidLevel {
  const width = Math.max(1, Math.ceil(level.width / 2));
  const height = Math.max(1, Math.ceil(level.height / 2));
  return {
    data: resizeBilinear(
      atrousBlur(level.data, level.width, level.height, 1),
      level.width,
      level.height,
      width,
      height,
    ),
    width,
    height,
  };
}

export function buildLaplacian(
  source: Float32Array,
  width: number,
  height: number,
  levels: number,
): PyramidLevel[] {
  const pyramid: PyramidLevel[] = [];
  let current = { data: source, width, height };
  for (
    let level = 0;
    level < levels && current.width > 4 && current.height > 4;
    level += 1
  ) {
    const down = gaussDown(current);
    const up = resizeBilinear(
      down.data,
      down.width,
      down.height,
      current.width,
      current.height,
    );
    pyramid.push({
      data: subtract(current.data, up),
      width: current.width,
      height: current.height,
    });
    current = down;
  }
  pyramid.push(current);
  return pyramid;
}

export function collapseLaplacian(pyramid: PyramidLevel[]): Float32Array {
  let current = pyramid[pyramid.length - 1];
  for (let level = pyramid.length - 2; level >= 0; level -= 1) {
    const target = pyramid[level];
    const up = resizeBilinear(
      current.data,
      current.width,
      current.height,
      target.width,
      target.height,
    );
    for (let i = 0; i < up.length; i += 1) up[i] += target.data[i];
    current = { data: up, width: target.width, height: target.height };
  }
  return current.data;
}

export function eigenSymmetric3(matrix: number[][]): {
  values: [number, number, number];
  vectors: [[number, number, number], [number, number, number], [number, number, number]];
} {
  const values = matrix.map((row) => row.slice());
  const vectors = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  for (let sweep = 0; sweep < 50; sweep += 1) {
    let offDiagonal = 0;
    for (let p = 0; p < 3; p += 1) {
      for (let q = p + 1; q < 3; q += 1) {
        offDiagonal += values[p][q] ** 2;
      }
    }
    if (offDiagonal < 1e-20) break;
    for (let p = 0; p < 3; p += 1) {
      for (let q = p + 1; q < 3; q += 1) {
        if (Math.abs(values[p][q]) < 1e-30) continue;
        const theta = (values[q][q] - values[p][p]) / (2 * values[p][q]);
        const t =
          Math.sign(theta || 1) /
          (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k += 1) {
          const akp = values[k][p];
          const akq = values[k][q];
          values[k][p] = c * akp - s * akq;
          values[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k += 1) {
          const apk = values[p][k];
          const aqk = values[q][k];
          values[p][k] = c * apk - s * aqk;
          values[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k += 1) {
          const vkp = vectors[k][p];
          const vkq = vectors[k][q];
          vectors[k][p] = c * vkp - s * vkq;
          vectors[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  const diagonal = [values[0][0], values[1][1], values[2][2]];
  const order = [0, 1, 2].sort((a, b) => diagonal[b] - diagonal[a]);
  return {
    values: order.map((index) => diagonal[index]) as [number, number, number],
    vectors: order.map(
      (index) =>
        [vectors[0][index], vectors[1][index], vectors[2][index]] as [
          number,
          number,
          number,
        ],
    ) as [[number, number, number], [number, number, number], [number, number, number]],
  };
}

export const simpleMean: FusionAlgorithm = (_pan, ms) =>
  ms.map((band) => Float32Array.from(band, (value, i) => (value + _pan[i]) / 2)) as FusionPlanes;

export const brovey: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  const reference = options.reference;
  const currentIntensity = intensity(ms);
  const matchedPan = matchStats(
    pan,
    currentIntensity,
    reference?.pan,
    reference?.intensity,
  );
  return ms.map((band) =>
    Float32Array.from(
      band,
      (value, i) => (value * matchedPan[i]) / (currentIntensity[i] + EPS),
    ),
  ) as FusionPlanes;
};

export const ihs: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  const currentIntensity = intensity(ms);
  const matchedPan = matchStats(
    pan,
    currentIntensity,
    options.reference?.pan,
    options.reference?.intensity,
  );
  return inject(ms, subtract(matchedPan, currentIntensity));
};

export const esri: FusionAlgorithm = (_pan, ms, _width, _height, options = {}) =>
  inject(ms, subtract(_pan, intensity(ms, options.weights)));

export const pca: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  const n = pan.length;
  const reference = options.reference;
  let means: [number, number, number];
  let vector: [number, number, number];
  let principalStats: FusionStats;

  if (reference) {
    means = reference.rgbMean;
    vector = reference.pcaVector;
    principalStats = reference.pca;
  } else {
    means = ms.map((band) => stats(band).mean) as [number, number, number];
    const matrix = [0, 1, 2].map((i) =>
      [0, 1, 2].map((j) => covariance(ms[i], ms[j])),
    );
    const eigen = eigenSymmetric3(matrix);
    vector = eigen.vectors[0];
    if (vector[0] + vector[1] + vector[2] < 0) {
      vector = vector.map((value) => -value) as [number, number, number];
    }
    principalStats = { mean: 0, std: Math.sqrt(Math.max(eigen.values[0], EPS * EPS)) };
  }

  const principal = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    principal[i] =
      vector[0] * (ms[0][i] - means[0]) +
      vector[1] * (ms[1][i] - means[1]) +
      vector[2] * (ms[2][i] - means[2]);
  }
  return inject(
    ms,
    subtract(matchStats(pan, principal, reference?.pan, principalStats), principal),
    vector,
  );
};

export const gramSchmidt: FusionAlgorithm = (pan, ms, _width, _height, options = {}) => {
  const currentIntensity = intensity(ms);
  const reference = options.reference;
  const variance = reference
    ? reference.intensity.std ** 2
    : stats(currentIntensity).std ** 2;
  const gains =
    reference?.gramSchmidtGains ??
    (ms.map((band) => covariance(band, currentIntensity) / variance) as [
      number,
      number,
      number,
    ]);
  const matchedPan = matchStats(
    pan,
    currentIntensity,
    reference?.pan,
    reference?.intensity,
  );
  return inject(ms, subtract(matchedPan, currentIntensity), gains);
};

export const hpf: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  const radius = options.radius ?? 4;
  const currentIntensity = intensity(ms);
  const matchedPan = matchStats(
    pan,
    currentIntensity,
    options.reference?.pan,
    options.reference?.intensity,
  );
  const detail = smooth(matchedPan, width, height, radius);
  for (let i = 0; i < detail.length; i += 1) {
    detail[i] = (matchedPan[i] - detail[i]) * (options.gain ?? 1);
  }
  return options.proportional === false
    ? inject(ms, detail)
    : injectProportional(ms, detail, currentIntensity);
};

export const wavelet: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  const currentIntensity = intensity(ms);
  let current = matchStats(
    pan,
    currentIntensity,
    options.reference?.pan,
    options.reference?.intensity,
  );
  const detail = new Float32Array(current.length);
  for (let level = 0; level < (options.levels ?? 3); level += 1) {
    const next = atrousBlur(current, width, height, 1 << level);
    for (let i = 0; i < current.length; i += 1) {
      detail[i] += current[i] - next[i];
    }
    current = next;
  }
  return options.proportional === false
    ? inject(ms, detail)
    : injectProportional(ms, detail, currentIntensity);
};

export const laplacian: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  const currentIntensity = intensity(ms);
  const matchedPan = matchStats(
    pan,
    currentIntensity,
    options.reference?.pan,
    options.reference?.intensity,
  );
  const intensityPyramid = buildLaplacian(
    currentIntensity,
    width,
    height,
    options.levels ?? 5,
  );
  const panPyramid = buildLaplacian(
    matchedPan,
    width,
    height,
    options.levels ?? 5,
  );
  const fusedPyramid = intensityPyramid.map((level, index) => {
    if (index === intensityPyramid.length - 1) return level;
    const details = Float32Array.from(level.data, (value, i) =>
      Math.abs(panPyramid[index].data[i]) >= Math.abs(value)
        ? panPyramid[index].data[i]
        : value,
    );
    return { ...level, data: details };
  });
  return inject(ms, subtract(collapseLaplacian(fusedPyramid), currentIntensity));
};

export const guided: FusionAlgorithm = (pan, ms, width, height, options = {}) => {
  const radius = options.radius ?? 4;
  const epsilon = options.eps ?? 1e-3;
  const box = (plane: Float32Array) => boxBlur(plane, width, height, radius);
  const meanPan = box(pan);
  const squaredPan = Float32Array.from(pan, (value) => value * value);
  const meanSquaredPan = box(squaredPan);

  return ms.map((band) => {
    const meanBand = box(band);
    const product = Float32Array.from(pan, (value, i) => value * band[i]);
    const meanProduct = box(product);
    const a = new Float32Array(pan.length);
    const b = new Float32Array(pan.length);
    for (let i = 0; i < pan.length; i += 1) {
      a[i] =
        (meanProduct[i] - meanPan[i] * meanBand[i]) /
        (meanSquaredPan[i] - meanPan[i] * meanPan[i] + epsilon);
      b[i] = meanBand[i] - a[i] * meanPan[i];
    }
    const meanA = box(a);
    const meanB = box(b);
    const output = new Float32Array(pan.length);
    for (let i = 0; i < pan.length; i += 1) {
      output[i] = meanA[i] * pan[i] + meanB[i];
    }
    return output;
  }) as FusionPlanes;
};

export const FUSION_ALGORITHMS: Record<string, FusionAlgorithm> = {
  simpleMean,
  brovey,
  ihs,
  esri,
  pca,
  gramSchmidt,
  hpf,
  wavelet,
  laplacian,
  guided,
};

export function qualityIndex(
  output: FusionPlanes,
  pan: Float32Array,
  ms: FusionPlanes,
  width: number,
  height: number,
  radius = 2,
): { spectral: number; spatial: number } {
  const high = (plane: Float32Array) =>
    subtract(plane, smooth(plane, width, height, radius));
  const highPan = high(pan);
  let spectral = 0;
  let spatial = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    spectral += correlation(output[channel], ms[channel]);
    spatial += correlation(high(output[channel]), highPan);
  }
  return { spectral: spectral / 3, spatial: spatial / 3 };
}

export function computeFusionReference(
  pan: Uint8Array,
  rgb: Uint8Array,
  width: number,
  height: number,
  sampleStep = 4,
  isValid: (x: number, y: number) => boolean = () => true,
): FusionReference {
  let count = 0;
  let sumPan = 0;
  let sumPanSquared = 0;
  const sums = [0, 0, 0];
  const products = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  let sumIntensity = 0;
  let sumIntensitySquared = 0;
  const panIntensity = [0, 0, 0];

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      if (!isValid(x, y)) continue;
      const pixel = y * width + x;
      const offset = pixel * 3;
      const values = [
        rgb[offset] / 255,
        rgb[offset + 1] / 255,
        rgb[offset + 2] / 255,
      ];
      const p = pan[pixel] / 255;
      const i = (values[0] + values[1] + values[2]) / 3;
      count += 1;
      sumPan += p;
      sumPanSquared += p * p;
      sumIntensity += i;
      sumIntensitySquared += i * i;
      for (let a = 0; a < 3; a += 1) {
        sums[a] += values[a];
        panIntensity[a] += values[a] * i;
        for (let b = 0; b < 3; b += 1) {
          products[a][b] += values[a] * values[b];
        }
      }
    }
  }

  if (count === 0) {
    throw new Error('Aucun pixel disponible pour les statistiques de fusion.');
  }
  const rgbMean = sums.map((sum) => sum / count) as [
    number,
    number,
    number,
  ];
  const covarianceMatrix = products.map((row, a) =>
    row.map((sum, b) => sum / count - rgbMean[a] * rgbMean[b]),
  );
  const panMean = sumPan / count;
  const panStats = {
    mean: panMean,
    std: Math.sqrt(Math.max(sumPanSquared / count - panMean ** 2, EPS * EPS)),
  };
  const intensityMean = sumIntensity / count;
  const intensityStats = {
    mean: intensityMean,
    std: Math.sqrt(
      Math.max(sumIntensitySquared / count - intensityMean ** 2, EPS * EPS),
    ),
  };
  const eigen = eigenSymmetric3(covarianceMatrix);
  let pcaVector = eigen.vectors[0];
  if (pcaVector[0] + pcaVector[1] + pcaVector[2] < 0) {
    pcaVector = pcaVector.map((value) => -value) as [
      number,
      number,
      number,
    ];
  }
  const pcaVariance =
    pcaVector[0] ** 2 * covarianceMatrix[0][0] +
    pcaVector[1] ** 2 * covarianceMatrix[1][1] +
    pcaVector[2] ** 2 * covarianceMatrix[2][2] +
    2 *
      (pcaVector[0] * pcaVector[1] * covarianceMatrix[0][1] +
        pcaVector[0] * pcaVector[2] * covarianceMatrix[0][2] +
        pcaVector[1] * pcaVector[2] * covarianceMatrix[1][2]);
  const pcaStd = Math.sqrt(Math.max(pcaVariance, EPS * EPS));
  const varianceIntensity = Math.max(intensityStats.std ** 2, EPS * EPS);

  return {
    pan: panStats,
    intensity: intensityStats,
    rgbMean,
    pcaVector,
    pca: { mean: 0, std: pcaStd },
    gramSchmidtGains: panIntensity.map(
      (product, channel) =>
        (product / count - rgbMean[channel] * intensityMean) /
        varianceIntensity,
    ) as [number, number, number],
  };
}

function assertDimensions(
  values: Float32Array,
  width: number,
  height: number,
): void {
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    !Number.isInteger(height) ||
    height < 1 ||
    values.length !== width * height
  ) {
    throw new Error('Dimensions invalides pour le plan de fusion.');
  }
}
