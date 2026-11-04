import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { TtlCache } from './cache';
import { MARS_CONFIG, type MarsConfig } from './mars.config';
import { MarsTileService } from './mars-imagery-tile.service';

interface SharpPipeline {
  toColourspace(colorSpace: 'srgb'): SharpPipeline;
  greyscale(): SharpPipeline;
  removeAlpha(): SharpPipeline;
  extract(options: {
    left: number;
    top: number;
    width: number;
    height: number;
  }): SharpPipeline;
  resize(
    width: number,
    height: number,
    options: { fit: 'fill'; kernel?: 'cubic' },
  ): SharpPipeline;
  raw(): SharpPipeline;
  png(): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (
  input: Buffer,
  options?: {
    raw: { width: number; height: number; channels: 3 | 4 };
  },
) => SharpPipeline;

const sharp = createRequire(__filename)('sharp') as SharpFactory;

const TILE_ZOOM = 3;
const VIKING_TILE_SIZE = 256;
const CTX_TILE_SIZE = 512;
const TILE_COLUMNS = 2 ** (TILE_ZOOM + 1);
const TILE_ROWS = 2 ** TILE_ZOOM;
const VIKING_WIDTH = TILE_COLUMNS * VIKING_TILE_SIZE;
const VIKING_HEIGHT = TILE_ROWS * VIKING_TILE_SIZE;
const OUTPUT_WIDTH = TILE_COLUMNS * CTX_TILE_SIZE;
const OUTPUT_HEIGHT = TILE_ROWS * CTX_TILE_SIZE;
const BLEND_MAX_ZOOM = TILE_ZOOM;
const FETCH_CONCURRENCY = 8;
const CACHE_KEY = 'viking-ctx-lab-detail-v2';
const BLEND_TILE_SIZE = CTX_TILE_SIZE;
const PROCESS_TILE_SIZE = 1_024;
const WHITE_POINT = [0.95047, 1, 1.08883] as const;
const LAB_DELTA = 6 / 29;
const DEFAULT_FUSION_OPTIONS: MarsFusionOptions = {
  radius: 2,
  detail: 1,
  mix: 0.2,
  grade: 0.5,
  gradeL: 0.1,
  softness: 12,
  vibrance: 1.3,
  contrast: 1.08,
  pivot: 50,
};

export const MARS_BLEND_PALETTE = [
  { name: "Noir d'espace", hex: '#0B080C', rgb: [11, 8, 12] },
  { name: 'Violet sombre', hex: '#2D234A', rgb: [45, 35, 74] },
  { name: 'Violet indigo', hex: '#423769', rgb: [66, 55, 105] },
  { name: 'Rouge terre', hex: '#814A51', rgb: [129, 74, 81] },
  { name: 'Orange cuivré', hex: '#B86B66', rgb: [184, 107, 102] },
  { name: 'Pêche clair', hex: '#D68C79', rgb: [214, 140, 121] },
  { name: 'Blanc cassé', hex: '#E8DFDD', rgb: [232, 223, 221] },
] as const;

export interface MarsBlendResult {
  buffer: Buffer;
  missingCtxTiles: number;
  paletteCounts: number[];
}

export const MARS_BLEND_LAYER_ID = 'mars-viking-ctx-blend';

export interface MarsFusionOptions {
  radius: number;
  detail: number;
  mix: number;
  grade: number;
  gradeL: number;
  softness: number;
  vibrance: number;
  contrast: number;
  pivot: number;
}

export interface MarsFusionStats {
  vikMean: number;
  vikStd: number;
  ctxMean: number;
  ctxStd: number;
  validCount: number;
}

@Injectable()
export class MarsBlendService {
  private readonly logger = new Logger(MarsBlendService.name);
  private readonly cache: TtlCache<MarsBlendResult>;
  private readonly tileCache: TtlCache<Buffer>;

  constructor(
    @Inject(MARS_CONFIG) config: MarsConfig,
    private readonly tiles: MarsTileService,
  ) {
    this.cache = new TtlCache(1, config.capabilitiesCacheTtlMs);
    this.tileCache = new TtlCache(
      128,
      config.capabilitiesCacheTtlMs,
    );
  }

  getBlend(): Promise<MarsBlendResult> {
    return this.cache
      .getOrLoad(CACHE_KEY, () => this.createBlend())
      .then(({ value }) => value);
  }

  getBlendTile(zoom: number, x: number, y: number): Promise<Buffer> {
    const columns = 2 ** (zoom + 1);
    const rows = 2 ** zoom;
    if (
      !Number.isInteger(zoom) ||
      zoom < 0 ||
      zoom > BLEND_MAX_ZOOM ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= columns ||
      y < 0 ||
      y >= rows
    ) {
      throw new HttpException('Coordonnées de tuile Mars blend invalides.', 400);
    }

    const key = `${CACHE_KEY}/${zoom}/${x}/${y}`;
    return this.tileCache
      .getOrLoad(key, async () => {
        const { buffer } = await this.getBlend();
        const left = Math.floor((x * OUTPUT_WIDTH) / columns);
        const right = Math.floor(((x + 1) * OUTPUT_WIDTH) / columns);
        const top = Math.floor((y * OUTPUT_HEIGHT) / rows);
        const bottom = Math.floor(((y + 1) * OUTPUT_HEIGHT) / rows);
        return sharp(buffer)
          .extract({
            left,
            top,
            width: right - left,
            height: bottom - top,
          })
          .resize(BLEND_TILE_SIZE, BLEND_TILE_SIZE, { fit: 'fill' })
          .png()
          .toBuffer();
      })
      .then(({ value }) => value);
  }

  private async createBlend(): Promise<MarsBlendResult> {
    const vikingMosaic = Buffer.alloc(VIKING_WIDTH * VIKING_HEIGHT * 3);
    const ctxMosaic = Buffer.alloc(OUTPUT_WIDTH * OUTPUT_HEIGHT);
    let nextTile = 0;
    let missingCtxTiles = 0;
    const tileCount = TILE_COLUMNS * TILE_ROWS;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextTile++;
        if (index >= tileCount) return;

        const x = index % TILE_COLUMNS;
        const y = Math.floor(index / TILE_COLUMNS);
        const viking = await this.getVikingTile(x, y);
        let ctx: Buffer | null;
        try {
          ctx = await this.getCtxTile(x, y);
        } catch (error) {
          if (!isMissingTile(error)) throw error;
          ctx = null;
        }

        copyVikingTile(vikingMosaic, viking, x, y);
        if (ctx) {
          copyCtxTile(ctxMosaic, ctx, x, y);
        } else {
          missingCtxTiles += 1;
        }
      }
    };

    await Promise.all(
      Array.from({ length: FETCH_CONCURRENCY }, () => worker()),
    );

    if (missingCtxTiles === tileCount) {
      throw new BadGatewayException(
        'La mosaïque CTX du Murray Lab est indisponible ; fusion annulée.',
      );
    }

    if (missingCtxTiles > 0) {
      this.logger.warn(
        `${missingCtxTiles}/${tileCount} tuiles CTX indisponibles ; Viking couvre ces zones.`,
      );
    }

    const vikingHighResolution = await sharp(vikingMosaic, {
      raw: { width: VIKING_WIDTH, height: VIKING_HEIGHT, channels: 3 },
    })
      .resize(OUTPUT_WIDTH, OUTPUT_HEIGHT, { fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer();
    const stats = computeFusionStats(vikingMosaic, ctxMosaic);
    if (stats.validCount === 0) {
      throw new BadGatewayException(
        'La mosaïque CTX ne contient aucune donnée exploitable ; fusion annulée.',
      );
    }
    const { pixels, counts } = processMarsFusion(
      vikingHighResolution,
      ctxMosaic,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
      stats,
      DEFAULT_FUSION_OPTIONS,
    );
    const buffer = await sharp(pixels, {
      raw: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, channels: 3 },
    })
      .png()
      .toBuffer();

    return { buffer, missingCtxTiles, paletteCounts: counts };
  }

  private async getVikingTile(x: number, y: number): Promise<Buffer> {
    const tile = await this.tiles.getTile(
      'mars-trek',
      'viking-mdim21',
      TILE_ZOOM,
      x,
      y,
    );
    return sharp(tile.buffer)
      .toColourspace('srgb')
      .removeAlpha()
      .resize(VIKING_TILE_SIZE, VIKING_TILE_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer();
  }

  private async getCtxTile(x: number, y: number): Promise<Buffer> {
    const tile = await this.tiles.getTile(
      'murray-lab',
      'ctx-mosaic-v01',
      TILE_ZOOM,
      x,
      y,
    );
    return sharp(tile.buffer)
      .toColourspace('srgb')
      .greyscale()
      .removeAlpha()
      .resize(CTX_TILE_SIZE, CTX_TILE_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer();
  }
}

export function processMarsFusion(
  vikingRgb: Uint8Array,
  ctxGray: Uint8Array,
  width: number,
  height: number,
  stats: MarsFusionStats,
  options: MarsFusionOptions = DEFAULT_FUSION_OPTIONS,
): { pixels: Buffer; counts: number[] } {
  if (
    !Number.isInteger(width) ||
    width < 1 ||
    !Number.isInteger(height) ||
    height < 1 ||
    vikingRgb.length !== width * height * 3 ||
    ctxGray.length !== width * height
  ) {
    throw new Error('Dimensions ou données invalides pour la fusion Mars.');
  }
  validateOptions(options);

  const pixels = Buffer.alloc(width * height * 3);
  const counts = Array<number>(MARS_BLEND_PALETTE.length).fill(0);
  const margin = 2 * options.radius + 2;

  for (let y = 0; y < height; y += PROCESS_TILE_SIZE) {
    for (let x = 0; x < width; x += PROCESS_TILE_SIZE) {
      const coreWidth = Math.min(PROCESS_TILE_SIZE, width - x);
      const coreHeight = Math.min(PROCESS_TILE_SIZE, height - y);
      const x0 = Math.max(0, x - margin);
      const y0 = Math.max(0, y - margin);
      const x1 = Math.min(width, x + coreWidth + margin);
      const y1 = Math.min(height, y + coreHeight + margin);
      const patchWidth = x1 - x0;
      const patchHeight = y1 - y0;
      const patchRgb = Buffer.alloc(patchWidth * patchHeight * 3);
      const patchCtx = Buffer.alloc(patchWidth * patchHeight);

      for (let row = 0; row < patchHeight; row += 1) {
        const sourcePixel = (y0 + row) * width + x0;
        const targetPixel = row * patchWidth;
        patchRgb.set(
          vikingRgb.subarray(
            sourcePixel * 3,
            (sourcePixel + patchWidth) * 3,
          ),
          targetPixel * 3,
        );
        patchCtx.set(
          ctxGray.subarray(sourcePixel, sourcePixel + patchWidth),
          targetPixel,
        );
      }

      const patch = processFusionPatch(
        patchRgb,
        patchCtx,
        patchWidth,
        patchHeight,
        stats,
        options,
      );
      const cropX = x - x0;
      const cropY = y - y0;
      for (let row = 0; row < coreHeight; row += 1) {
        const sourceStart = ((cropY + row) * patchWidth + cropX) * 3;
        const targetStart = ((y + row) * width + x) * 3;
        const byteLength = coreWidth * 3;
        patch.pixels.copy(pixels, targetStart, sourceStart, sourceStart + byteLength);
      }

      for (let row = cropY; row < cropY + coreHeight; row += 1) {
        for (let column = cropX; column < cropX + coreWidth; column += 1) {
          const pixel = (row * patchWidth + column) * 3;
          let nearest = 0;
          let nearestDistance = Number.POSITIVE_INFINITY;
          for (let color = 0; color < MARS_BLEND_PALETTE.length; color += 1) {
            const [red, green, blue] = MARS_BLEND_PALETTE[color].rgb;
            const dr = patch.pixels[pixel] - red;
            const dg = patch.pixels[pixel + 1] - green;
            const db = patch.pixels[pixel + 2] - blue;
            const distance = dr * dr + dg * dg + db * db;
            if (distance < nearestDistance) {
              nearest = color;
              nearestDistance = distance;
            }
          }
          counts[nearest] += 1;
        }
      }
    }
  }

  return { pixels, counts };
}

function computeFusionStats(
  vikingRgb: Uint8Array,
  ctxGray: Uint8Array,
): MarsFusionStats {
  let vikSum = 0;
  let vikSquaredSum = 0;
  let ctxSum = 0;
  let ctxSquaredSum = 0;
  let validCount = 0;

  for (let y = 0; y < VIKING_HEIGHT; y += 1) {
    for (let x = 0; x < VIKING_WIDTH; x += 1) {
      const ctxOffset = (y * 2) * OUTPUT_WIDTH + x * 2;
      const ctxAverage = Math.round(
        (ctxGray[ctxOffset] +
          ctxGray[ctxOffset + 1] +
          ctxGray[ctxOffset + OUTPUT_WIDTH] +
          ctxGray[ctxOffset + OUTPUT_WIDTH + 1]) /
          4,
      );
      if (ctxAverage === 0) continue;

      const vikingOffset = (y * VIKING_WIDTH + x) * 3;
      const vikingL = rgbToLab(
        vikingRgb[vikingOffset],
        vikingRgb[vikingOffset + 1],
        vikingRgb[vikingOffset + 2],
      )[0];
      const ctxL = grayToLabL(ctxAverage);
      vikSum += vikingL;
      vikSquaredSum += vikingL * vikingL;
      ctxSum += ctxL;
      ctxSquaredSum += ctxL * ctxL;
      validCount += 1;
    }
  }

  const vikMean = vikSum / Math.max(validCount, 1);
  const ctxMean = ctxSum / Math.max(validCount, 1);
  return {
    vikMean,
    vikStd: Math.sqrt(Math.max(0, vikSquaredSum / Math.max(validCount, 1) - vikMean ** 2)),
    ctxMean,
    ctxStd: Math.sqrt(Math.max(0, ctxSquaredSum / Math.max(validCount, 1) - ctxMean ** 2)),
    validCount,
  };
}

function copyVikingTile(
  mosaic: Buffer,
  tile: Buffer,
  tileX: number,
  tileY: number,
): void {
  const rowBytes = VIKING_TILE_SIZE * 3;
  for (let row = 0; row < VIKING_TILE_SIZE; row += 1) {
    const source = row * rowBytes;
    const target =
      ((tileY * VIKING_TILE_SIZE + row) * VIKING_WIDTH +
        tileX * VIKING_TILE_SIZE) *
      3;
    tile.copy(mosaic, target, source, source + rowBytes);
  }
}

function copyCtxTile(
  mosaic: Buffer,
  tile: Buffer,
  tileX: number,
  tileY: number,
): void {
  for (let row = 0; row < CTX_TILE_SIZE; row += 1) {
    const source = row * CTX_TILE_SIZE;
    const target =
      (tileY * CTX_TILE_SIZE + row) * OUTPUT_WIDTH +
      tileX * CTX_TILE_SIZE;
    tile.copy(mosaic, target, source, source + CTX_TILE_SIZE);
  }
}

function processFusionPatch(
  vikingRgb: Uint8Array,
  ctxGray: Uint8Array,
  width: number,
  height: number,
  stats: MarsFusionStats,
  options: MarsFusionOptions,
): { pixels: Buffer } {
  const length = width * height;
  const vikingLab = new Float32Array(length * 3);
  const ctxL = new Float32Array(length);
  const correctedL = new Float32Array(length);
  const valid = new Uint8Array(length);
  for (let pixel = 0; pixel < length; pixel += 1) {
    const rgb = pixel * 3;
    const [l, a, b] = rgbToLab(
      vikingRgb[rgb],
      vikingRgb[rgb + 1],
      vikingRgb[rgb + 2],
    );
    vikingLab[rgb] = l;
    vikingLab[rgb + 1] = a;
    vikingLab[rgb + 2] = b;
    valid[pixel] = ctxGray[pixel] === 0 ? 0 : 1;
    ctxL[pixel] = grayToLabL(ctxGray[pixel]);
    correctedL[pixel] = valid[pixel]
      ? (ctxL[pixel] - stats.ctxMean) *
          (stats.vikStd / Math.max(stats.ctxStd, 1e-6)) +
        stats.vikMean
      : l;
  }

  const low = boxBlur(
    boxBlur(correctedL, width, height, options.radius),
    width,
    height,
    options.radius,
  );
  const pixels = Buffer.alloc(length * 3);
  const paletteLab = MARS_BLEND_PALETTE.slice(1).map(({ rgb }) =>
    rgbToLab(rgb[0], rgb[1], rgb[2]),
  );
  const softnessDenominator = 2 * options.softness ** 2;

  for (let pixel = 0; pixel < length; pixel += 1) {
    const offset = pixel * 3;
    const fusedLuminance =
      (1 - options.mix) * vikingLab[offset] +
      options.mix * low[pixel] +
      options.detail * (correctedL[pixel] - low[pixel]) * valid[pixel];
    let a = vikingLab[offset + 1];
    let b = vikingLab[offset + 2];
    let minimumDistance = Number.POSITIVE_INFINITY;
    for (const [targetL, targetA, targetB] of paletteLab) {
      const dL = fusedLuminance - targetL;
      const dA = a - targetA;
      const dB = b - targetB;
      minimumDistance = Math.min(
        minimumDistance,
        dL * dL + dA * dA + dB * dB,
      );
    }

    let weightSum = 0;
    let targetL = 0;
    let targetA = 0;
    let targetB = 0;
    for (const [paletteL, paletteA, paletteB] of paletteLab) {
      const dL = fusedLuminance - paletteL;
      const dA = a - paletteA;
      const dB = b - paletteB;
      const weight = Math.exp(
        -((dL * dL + dA * dA + dB * dB - minimumDistance) /
          softnessDenominator),
      );
      weightSum += weight;
      targetL += weight * paletteL;
      targetA += weight * paletteA;
      targetB += weight * paletteB;
    }
    targetL /= weightSum;
    targetA /= weightSum;
    targetB /= weightSum;
    a += options.grade * (targetA - a);
    b += options.grade * (targetB - b);
    let gradedL = fusedLuminance + options.gradeL * (targetL - fusedLuminance);
    a *= options.vibrance;
    b *= options.vibrance;
    gradedL = Math.max(
      0,
      Math.min(100, options.pivot + (gradedL - options.pivot) * options.contrast),
    );
    const [red, green, blue] = labToRgb(gradedL, a, b);
    pixels[offset] = clampByte(red);
    pixels[offset + 1] = clampByte(green);
    pixels[offset + 2] = clampByte(blue);
  }

  return { pixels };
}

function boxBlur(
  image: Float32Array,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  if (radius === 0) return image;
  const paddedWidth = width + radius * 2;
  const paddedHeight = height + radius * 2;
  const stride = paddedWidth + 1;
  const integral = new Float64Array((paddedHeight + 1) * stride);

  for (let paddedY = 0; paddedY < paddedHeight; paddedY += 1) {
    const sourceY = Math.max(0, Math.min(height - 1, paddedY - radius));
    let rowSum = 0;
    for (let paddedX = 0; paddedX < paddedWidth; paddedX += 1) {
      const sourceX = Math.max(0, Math.min(width - 1, paddedX - radius));
      rowSum += image[sourceY * width + sourceX];
      integral[(paddedY + 1) * stride + paddedX + 1] =
        integral[paddedY * stride + paddedX + 1] + rowSum;
    }
  }

  const result = new Float32Array(width * height);
  const windowSize = radius * 2 + 1;
  const divisor = windowSize * windowSize;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const topLeft = y * stride + x;
      const bottomRight = (y + windowSize) * stride + x + windowSize;
      result[y * width + x] =
        (integral[bottomRight] -
          integral[topLeft + windowSize] -
          integral[topLeft + windowSize * stride] +
          integral[topLeft]) /
        divisor;
    }
  }
  return result;
}

function rgbToLab(red: number, green: number, blue: number): [number, number, number] {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE_POINT[0];
  const y = (0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE_POINT[1];
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE_POINT[2];
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToRgb(l: number, a: number, b: number): [number, number, number] {
  const fy = (l + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const x = WHITE_POINT[0] * labFInverse(fx);
  const y = WHITE_POINT[1] * labFInverse(fy);
  const z = WHITE_POINT[2] * labFInverse(fz);
  return [
    linearToSrgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z),
    linearToSrgb(-0.969266 * x + 1.8760108 * y + 0.041556 * z),
    linearToSrgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z),
  ];
}

function grayToLabL(gray: number): number {
  const linear = srgbToLinear(gray);
  return 116 * labF(linear) - 16;
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    255 *
    (clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055)
  );
}

function labF(value: number): number {
  return value > LAB_DELTA ** 3
    ? Math.cbrt(value)
    : value / (3 * LAB_DELTA ** 2) + 4 / 29;
}

function labFInverse(value: number): number {
  return value > LAB_DELTA
    ? value ** 3
    : 3 * LAB_DELTA ** 2 * (value - 4 / 29);
}

function validateOptions(options: MarsFusionOptions): void {
  if (
    !Number.isInteger(options.radius) ||
    options.radius < 0 ||
    options.radius > 8 ||
    !Number.isFinite(options.detail) ||
    !Number.isFinite(options.mix) ||
    options.mix < 0 ||
    options.mix > 1 ||
    !Number.isFinite(options.grade) ||
    options.grade < 0 ||
    options.grade > 1 ||
    !Number.isFinite(options.gradeL) ||
    options.gradeL < 0 ||
    options.gradeL > 1 ||
    !Number.isFinite(options.softness) ||
    options.softness <= 0 ||
    !Number.isFinite(options.vibrance) ||
    options.vibrance < 0 ||
    !Number.isFinite(options.contrast) ||
    options.contrast < 0 ||
    !Number.isFinite(options.pivot) ||
    options.pivot < 0 ||
    options.pivot > 100
  ) {
    throw new Error('Paramètres de fusion Lab Mars invalides.');
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function isMissingTile(error: unknown): boolean {
  return (
    error instanceof HttpException &&
    (error.getStatus() === 404 || error.getStatus() === 502)
  );
}
