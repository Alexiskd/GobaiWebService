import {
  BadRequestException,
  Controller,
  Get,
  Head,
  Headers,
  Inject,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { MercuryCapabilitiesService } from '../services/mercury/capabilities.service';
import { MercuryHealthService } from '../services/mercury/mercury-upstream-health.service';
import { MERCURY_CONFIG, type MercuryConfig } from '../services/mercury/mercury.config';
import { MercuryCatalogService } from '../services/mercury/mercury-catalog.service';
import type { BBox, TileFetchResult } from '../services/mercury/mercury.types';
import { MercuryTileService } from '../services/mercury/mercury-surface-tile.service';

@Controller('mercury')
export class MercuryController {
  constructor(
    @Inject(MERCURY_CONFIG) private readonly config: MercuryConfig,
    private readonly catalog: MercuryCatalogService,
    private readonly capabilitiesService: MercuryCapabilitiesService,
    private readonly tileService: MercuryTileService,
    private readonly healthService: MercuryHealthService,
  ) {}

  @Get()
  overview() {
    return {
      module: 'mercury',
      description:
        'Passerelle backend pour les services de tuiles et de terrain de Mercure.',
      limits: {
        tileCacheEntries: this.config.tileCacheEntries,
        tileCacheTtlMs: this.config.tileCacheTtlMs,
        capabilitiesCacheTtlMs: this.config.capabilitiesCacheTtlMs,
        maxUpstreamBytes: this.config.maxUpstreamBytes,
      },
      providers: this.catalog.listProviders().map((provider) => ({
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
        layers: provider.layers.length,
        requiresToken: provider.requiresToken,
      })),
      endpoints: {
        providers: '/api/v1/mercury/providers',
        provider: '/api/v1/mercury/providers/:provider',
        layers: '/api/v1/mercury/providers/:provider/layers',
        layer: '/api/v1/mercury/providers/:provider/layers/:layer',
        capabilities:
          '/api/v1/mercury/providers/:provider/capabilities?raw=1&refresh=1',
        tile: '/api/v1/mercury/providers/:provider/layers/:layer/tile/:z/:x/:y',
        tileMetadata:
          '/api/v1/mercury/providers/:provider/layers/:layer/tile/:z/:x/:y/metadata?fetch=1',
        tileAt:
          '/api/v1/mercury/providers/:provider/layers/:layer/tile-at?lon=&lat=&zoom=',
        coverage:
          '/api/v1/mercury/providers/:provider/layers/:layer/coverage?bbox=&zoom=&limit=',
        health: '/api/v1/mercury/health',
      },
    };
  }

  @Get('providers')
  listProviders() {
    return this.catalog.listSummaries();
  }

  @Get('health')
  health() {
    return this.healthService.check();
  }

  @Get('providers/:provider')
  getProvider(@Param('provider') provider: string) {
    return this.catalog.getProviderSummary(provider);
  }

  @Get('providers/:provider/layers')
  listLayers(@Param('provider') provider: string) {
    const definition = this.catalog.getProvider(provider);
    return definition.layers.map((layer) =>
      this.catalog.summarizeLayer(definition, layer),
    );
  }

  @Get('providers/:provider/layers/:layer')
  getLayer(@Param('provider') provider: string, @Param('layer') layer: string) {
    return this.catalog.describeLayer(provider, layer);
  }

  @Get('providers/:provider/capabilities')
  async capabilities(
    @Param('provider') provider: string,
    @Query('raw') raw: string | undefined,
    @Query('refresh') refresh: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.capabilitiesService.getCapabilities(provider, {
      raw: isTruthy(raw),
      refresh: isTruthy(refresh),
    });

    if (isTruthy(raw) && result.raw !== null) {
      res.type('application/xml; charset=utf-8');
      return result.raw;
    }

    return result.summary;
  }

  @Get('providers/:provider/layers/:layer/tile/:z/:x/:y/metadata')
  tileMetadata(
    @Param('provider') provider: string,
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Query('fetch') fetch: string | undefined,
  ) {
    return this.tileService.describeTile(
      provider,
      layer,
      parseInteger(z, 'z'),
      parseInteger(x, 'x'),
      parseInteger(y, 'y'),
      isTruthy(fetch),
    );
  }

  @Get('providers/:provider/layers/:layer/tile-at')
  tileAt(
    @Param('provider') provider: string,
    @Param('layer') layer: string,
    @Query('lon') lon: string | undefined,
    @Query('lat') lat: string | undefined,
    @Query('zoom') zoom: string | undefined,
    @Query('fetch') fetch: string | undefined,
  ) {
    return this.tileService.getTileAt(
      provider,
      layer,
      parseRequiredNumber(lon, 'lon'),
      parseRequiredNumber(lat, 'lat'),
      parseOptionalInteger(zoom, 'zoom'),
      isTruthy(fetch),
    );
  }

  @Get('providers/:provider/layers/:layer/coverage')
  coverage(
    @Param('provider') provider: string,
    @Param('layer') layer: string,
    @Query('bbox') bbox: string | undefined,
    @Query('zoom') zoom: string | undefined,
    @Query('limit') limit: string | undefined,
  ) {
    return this.tileService.coverage(provider, layer, {
      bbox: parseBBox(bbox),
      zoom: parseOptionalInteger(zoom, 'zoom'),
      limit: parseOptionalInteger(limit, 'limit'),
    });
  }

  @Get('providers/:provider/layers/:layer/tile/:z/:x/:y')
  async tile(
    @Param('provider') provider: string,
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.tileService.getTile(
      provider,
      layer,
      parseInteger(z, 'z'),
      parseInteger(x, 'x'),
      parseInteger(y, 'y'),
    );

    applyTileHeaders(res, result);

    if (etagMatches(ifNoneMatch, result.etag)) {
      res.status(304);
      return;
    }

    return new StreamableFile(result.buffer, {
      type: result.contentType,
      length: result.buffer.length,
    });
  }

  @Head('providers/:provider/layers/:layer/tile/:z/:x/:y')
  async headTile(
    @Param('provider') provider: string,
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.tileService.getTile(
      provider,
      layer,
      parseInteger(z, 'z'),
      parseInteger(x, 'x'),
      parseInteger(y, 'y'),
    );

    applyTileHeaders(res, result);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Length', result.buffer.length);
    res.status(200);
  }
}

function applyTileHeaders(res: Response, result: TileFetchResult): void {
  const { model } = result;
  const remainingMs =
    model.cache && !model.cache.stale
      ? Math.max(0, result.ttlMs - model.cache.ageMs)
      : 0;

  res.setHeader('ETag', result.etag);
  res.setHeader(
    'Cache-Control',
    `public, max-age=${Math.floor(remainingMs / 1_000)}, stale-while-revalidate=604800`,
  );
  res.setHeader(
    'X-Mercury-Cache',
    result.cacheStale ? 'STALE' : result.cacheHit ? 'HIT' : 'MISS',
  );
  res.setHeader('X-Mercury-Provider', model.provider.id);
  res.setHeader('X-Mercury-Layer', model.layer.id);
  res.setHeader('X-Mercury-Crs', model.crs);
  res.setHeader(
    'X-Mercury-Bbox',
    [model.bbox.west, model.bbox.south, model.bbox.east, model.bbox.north]
      .map((value) => String(Number(value.toFixed(6))))
      .join(','),
  );
  res.setHeader('Last-Modified', new Date(model.fetchedAt).toUTCString());

  if (model.image) {
    res.setHeader(
      'X-Mercury-Image',
      `${model.image.width}x${model.image.height}`,
    );
    res.setHeader('X-Mercury-Sha256', model.image.sha256);
  }
}

function etagMatches(header: string | undefined, etag: string): boolean {
  if (!header) {
    return false;
  }

  return header
    .split(',')
    .map((value) => value.trim())
    .some(
      (candidate) =>
        candidate === '*' || candidate === etag || candidate === `W/${etag}`,
    );
}

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true' || value === 'yes';
}

function parseInteger(value: string, name: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new BadRequestException(
      `Paramètre ${name} invalide : entier attendu.`,
    );
  }
  return Number(value);
}

function parseOptionalInteger(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  return parseInteger(value, name);
}

function parseRequiredNumber(value: string | undefined, name: string): number {
  const parsed = parseOptionalNumber(value, name);
  if (parsed === undefined) {
    throw new BadRequestException(`Paramètre ${name} requis.`);
  }
  return parsed;
}

function parseOptionalNumber(
  value: string | undefined,
  name: string,
): number | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(
      `Paramètre ${name} invalide : nombre attendu.`,
    );
  }

  return parsed;
}

function parseBBox(value: string | undefined): BBox | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }

  const parts = value.split(',').map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new BadRequestException(
      'Paramètre bbox invalide : format attendu west,south,east,north.',
    );
  }

  return { west: parts[0], south: parts[1], east: parts[2], north: parts[3] };
}
