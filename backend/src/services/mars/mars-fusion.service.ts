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
import {
  computeFusionReference,
  FUSION_ALGORITHMS,
  type FusionOptions,
  type FusionPlanes,
} from './fusion-algorithms';

interface SharpPipeline {
  toColourspace(colorSpace: 'srgb'): SharpPipeline;
  greyscale(): SharpPipeline;
  removeAlpha(): SharpPipeline;
  extractChannel(channel: number): SharpPipeline;
  resize(
    width: number,
    height: number,
    options: { fit: 'fill'; kernel?: 'cubic' },
  ): SharpPipeline;
  raw(): SharpPipeline;
  png(): SharpPipeline;
  composite(
    images: Array<{ input: Buffer; left: number; top: number }>,
  ): SharpPipeline;
  toBuffer(): Promise<Buffer>;
}

type SharpFactory = (
  input:
    | Buffer
    | {
        create: {
          width: number;
          height: number;
          channels: 3;
          background: { r: number; g: number; b: number };
        };
      },
  options?: {
    raw: { width: number; height: number; channels: 3 | 4 };
  },
) => SharpPipeline;

const sharp = createRequire(__filename)('sharp') as SharpFactory;
const TILE_ZOOM = 3;
const TILE_SIZE = 512;
const VIKING_TILE_SIZE = 256;
const TILE_COLUMNS = 2 ** (TILE_ZOOM + 1);
const TILE_ROWS = 2 ** TILE_ZOOM;
const WIDTH = TILE_COLUMNS * TILE_SIZE;
const HEIGHT = TILE_ROWS * TILE_SIZE;
const VIKING_WIDTH = TILE_COLUMNS * VIKING_TILE_SIZE;
const VIKING_HEIGHT = TILE_ROWS * VIKING_TILE_SIZE;
const FETCH_CONCURRENCY = 8;
const PATCH_MARGIN = 32;

export const MARS_FUSION_ALGORITHM_INFO = [
  {
    name: 'simpleMean',
    slug: 'simple-mean',
    label: 'Viking + CTX — moyenne simple',
    description: 'Moyenne pixel par pixel entre la luminance CTX et chaque bande Viking.',
  },
  {
    name: 'brovey',
    slug: 'brovey',
    label: 'Viking + CTX — Brovey',
    description: 'Injection du contraste CTX par rapport à l’intensité Viking.',
  },
  {
    name: 'ihs',
    slug: 'ihs',
    label: 'Viking + CTX — IHS',
    description: 'Remplacement de l’intensité Viking par la luminance CTX recalée.',
  },
  {
    name: 'esri',
    slug: 'esri',
    label: 'Viking + CTX — Esri',
    description: 'Moyenne pondérée Viking ajustée par la différence de luminance CTX.',
  },
  {
    name: 'pca',
    slug: 'pca',
    label: 'Viking + CTX — PCA',
    description: 'Remplacement de la première composante principale Viking par CTX.',
  },
  {
    name: 'gramSchmidt',
    slug: 'gram-schmidt',
    label: 'Viking + CTX — Gram–Schmidt',
    description: 'Injection adaptative du détail CTX avec un gain par bande Viking.',
  },
  {
    name: 'hpf',
    slug: 'hpf',
    label: 'Viking + CTX — passe-haut',
    description: 'Injection proportionnelle des détails haute fréquence CTX.',
  },
  {
    name: 'wavelet',
    slug: 'wavelet',
    label: 'Viking + CTX — ondelettes',
    description: 'Injection des détails CTX par ondelettes à trous B3-spline.',
  },
  {
    name: 'laplacian',
    slug: 'laplacian',
    label: 'Viking + CTX — pyramide laplacienne',
    description: 'Pyramide laplacienne CTX/Viking avec sélection des détails les plus nets.',
  },
  {
    name: 'guided',
    slug: 'guided',
    label: 'Viking + CTX — filtre guidé',
    description: 'Couleurs Viking guidées par les structures locales de la mosaïque CTX.',
  },
] as const;

export type MarsFusionAlgorithmName =
  (typeof MARS_FUSION_ALGORITHM_INFO)[number]['name'];

export function getMarsFusionLayerId(slug: string): string {
  return `mars-viking-ctx-${slug}`;
}

export function getMarsFusionAlgorithmByLayerId(
  layerId: string,
): (typeof MARS_FUSION_ALGORITHM_INFO)[number] | undefined {
  return MARS_FUSION_ALGORITHM_INFO.find(
    ({ slug }) => getMarsFusionLayerId(slug) === layerId,
  );
}

export function getMarsFusionAlgorithmBySlug(
  slug: string,
): (typeof MARS_FUSION_ALGORITHM_INFO)[number] | undefined {
  return MARS_FUSION_ALGORITHM_INFO.find(
    (algorithm) => algorithm.slug === slug,
  );
}

interface FusionSources {
  vikingRgb: Buffer;
  ctxGray: Buffer;
  ctxTileValid: Uint8Array;
  reference: ReturnType<typeof computeFusionReference>;
  missingCtxTiles: number;
}

@Injectable()
export class MarsFusionService {
  private readonly logger = new Logger(MarsFusionService.name);
  private readonly tileCache: TtlCache<Buffer>;
  private sourcePromise: Promise<FusionSources> | null = null;

  constructor(
    @Inject(MARS_CONFIG) config: MarsConfig,
    private readonly tiles: MarsTileService,
  ) {
    this.tileCache = new TtlCache(128, config.capabilitiesCacheTtlMs);
  }

  async getTile(
    algorithm: MarsFusionAlgorithmName,
    zoom: number,
    x: number,
    y: number,
  ): Promise<Buffer> {
    if (
      !FUSION_ALGORITHMS[algorithm] ||
      !Number.isInteger(zoom) ||
      zoom < 0 ||
      zoom > TILE_ZOOM ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x >= 2 ** (zoom + 1) ||
      y < 0 ||
      y >= 2 ** zoom
    ) {
      throw new HttpException('Coordonnées de tuile Mars fusion invalides.', 400);
    }

    if (zoom === TILE_ZOOM) {
      return this.getBaseTile(algorithm, x, y);
    }

    const factor = 2 ** (TILE_ZOOM - zoom);
    const children: Array<{ input: Buffer; left: number; top: number }> = [];
    for (let dy = 0; dy < factor; dy += 1) {
      for (let dx = 0; dx < factor; dx += 1) {
        children.push({
          input: await this.getBaseTile(
            algorithm,
            x * factor + dx,
            y * factor + dy,
          ),
          left: dx * TILE_SIZE,
          top: dy * TILE_SIZE,
        });
      }
    }

    return sharp({
      create: {
        width: factor * TILE_SIZE,
        height: factor * TILE_SIZE,
        channels: 3,
        background: { r: 0, g: 0, b: 0 },
      },
    })
      .composite(children)
      .resize(TILE_SIZE, TILE_SIZE, { fit: 'fill', kernel: 'cubic' })
      .png()
      .toBuffer();
  }

  private getBaseTile(
    algorithm: MarsFusionAlgorithmName,
    x: number,
    y: number,
  ): Promise<Buffer> {
    return this.tileCache
      .getOrLoad(`${algorithm}/${TILE_ZOOM}/${x}/${y}`, () =>
        this.createBaseTile(algorithm, x, y),
      )
      .then(({ value }) => value);
  }

  private async createBaseTile(
    algorithm: MarsFusionAlgorithmName,
    tileX: number,
    tileY: number,
  ): Promise<Buffer> {
    const sources = await this.getSources();
    const width = TILE_SIZE + PATCH_MARGIN * 2;
    const height = width;
    const pan = new Float32Array(width * height);
    const ms: FusionPlanes = [
      new Float32Array(width * height),
      new Float32Array(width * height),
      new Float32Array(width * height),
    ];
    const startX = tileX * TILE_SIZE - PATCH_MARGIN;
    const startY = tileY * TILE_SIZE - PATCH_MARGIN;

    for (let py = 0; py < height; py += 1) {
      const sourceY = Math.max(0, Math.min(HEIGHT - 1, startY + py));
      for (let px = 0; px < width; px += 1) {
        const sourceX = (startX + px + WIDTH) % WIDTH;
        const sourcePixel = sourceY * WIDTH + sourceX;
        const sourceRgb = sourcePixel * 3;
        const pixel = py * width + px;
        const red = sources.vikingRgb[sourceRgb] / 255;
        const green = sources.vikingRgb[sourceRgb + 1] / 255;
        const blue = sources.vikingRgb[sourceRgb + 2] / 255;
        ms[0][pixel] = red;
        ms[1][pixel] = green;
        ms[2][pixel] = blue;

        const ctxTile =
          Math.floor(sourceY / TILE_SIZE) * TILE_COLUMNS +
          Math.floor(sourceX / TILE_SIZE);
        const ctxValue = sources.ctxGray[sourcePixel];
        const hasCtx = sources.ctxTileValid[ctxTile] === 1 && ctxValue !== 0;
        pan[pixel] = hasCtx ? ctxValue / 255 : (red + green + blue) / 3;
      }
    }

    const options = this.algorithmOptions(algorithm, sources.reference);
    const fused = FUSION_ALGORITHMS[algorithm](
      pan,
      ms,
      width,
      height,
      options,
    );
    const output = Buffer.alloc(TILE_SIZE * TILE_SIZE * 3);
    for (let y = 0; y < TILE_SIZE; y += 1) {
      const sourceY = tileY * TILE_SIZE + y;
      const sourceOffset = (sourceY * WIDTH + tileX * TILE_SIZE) * 3;
      for (let x = 0; x < TILE_SIZE; x += 1) {
        const sourceX = tileX * TILE_SIZE + x;
        const sourcePixel = sourceY * WIDTH + sourceX;
        const patchPixel =
          (y + PATCH_MARGIN) * width + x + PATCH_MARGIN;
        const target = (y * TILE_SIZE + x) * 3;
        if (sources.ctxTileValid[
          Math.floor(sourceY / TILE_SIZE) * TILE_COLUMNS +
            Math.floor(sourceX / TILE_SIZE)
        ] !== 1 || sources.ctxGray[sourcePixel] === 0) {
          output[target] = sources.vikingRgb[sourceOffset + x * 3];
          output[target + 1] = sources.vikingRgb[sourceOffset + x * 3 + 1];
          output[target + 2] = sources.vikingRgb[sourceOffset + x * 3 + 2];
          continue;
        }
        for (let channel = 0; channel < 3; channel += 1) {
          const value = fused[channel][patchPixel];
          output[target + channel] = Math.round(
            Math.max(0, Math.min(1, value)) * 255,
          );
        }
      }
    }

    return sharp(output, {
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 3 },
    })
      .png()
      .toBuffer();
  }

  private algorithmOptions(
    algorithm: MarsFusionAlgorithmName,
    reference: FusionSources['reference'],
  ): FusionOptions {
    const options: FusionOptions = { reference };
    if (algorithm === 'hpf') options.radius = 1;
    if (algorithm === 'wavelet') options.levels = 1;
    if (algorithm === 'laplacian') options.levels = 2;
    if (algorithm === 'guided') options.radius = 2;
    return options;
  }

  private getSources(): Promise<FusionSources> {
    if (!this.sourcePromise) {
      this.sourcePromise = this.createSources().catch((error: unknown) => {
        this.sourcePromise = null;
        throw error;
      });
    }
    return this.sourcePromise;
  }

  private async createSources(): Promise<FusionSources> {
    const vikingMosaic = Buffer.alloc(VIKING_WIDTH * VIKING_HEIGHT * 3);
    const ctxMosaic = Buffer.alloc(WIDTH * HEIGHT);
    const ctxTileValid = new Uint8Array(TILE_COLUMNS * TILE_ROWS);
    let nextTile = 0;
    let missingCtxTiles = 0;
    const tileCount = TILE_COLUMNS * TILE_ROWS;

    const worker = async (): Promise<void> => {
      while (true) {
        const index = nextTile++;
        if (index >= tileCount) return;
        const x = index % TILE_COLUMNS;
        const y = Math.floor(index / TILE_COLUMNS);
        const [viking, ctx] = await Promise.all([
          this.getVikingTile(x, y),
          this.getCtxTile(x, y).catch((error: unknown) => {
            if (!isMissingTile(error)) throw error;
            return null;
          }),
        ]);
        copyVikingTile(vikingMosaic, viking, x, y);
        if (ctx) {
          copyCtxTile(ctxMosaic, ctx, x, y);
          ctxTileValid[index] = 1;
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
        `${missingCtxTiles}/${tileCount} tuiles CTX indisponibles ; ces zones gardent Viking.`,
      );
    }

    const vikingRgb = await sharp(vikingMosaic, {
      raw: { width: VIKING_WIDTH, height: VIKING_HEIGHT, channels: 3 },
    })
      .resize(WIDTH, HEIGHT, { fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer();
    const reference = computeFusionReference(
      ctxMosaic,
      vikingRgb,
      WIDTH,
      HEIGHT,
      4,
      (x, y) => {
        const index =
          Math.floor(y / TILE_SIZE) * TILE_COLUMNS +
          Math.floor(x / TILE_SIZE);
        return ctxTileValid[index] === 1 && ctxMosaic[y * WIDTH + x] !== 0;
      },
    );

    return { vikingRgb, ctxGray: ctxMosaic, ctxTileValid, reference, missingCtxTiles };
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
      .resize(TILE_SIZE, TILE_SIZE, { fit: 'fill' })
      .raw()
      .toBuffer();
  }
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
  for (let row = 0; row < TILE_SIZE; row += 1) {
    const source = row * TILE_SIZE;
    const target = (tileY * TILE_SIZE + row) * WIDTH + tileX * TILE_SIZE;
    tile.copy(mosaic, target, source, source + TILE_SIZE);
  }
}

function isMissingTile(error: unknown): boolean {
  return (
    error instanceof HttpException &&
    (error.getStatus() === 404 || error.getStatus() === 502)
  );
}
