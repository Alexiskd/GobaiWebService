import { Buffer } from 'node:buffer';
import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TtlCache, type CacheLookup } from './cache';
import { etagFromSha, inspectImage, sha256Hex } from './image';
import { MARS_CONFIG, type MarsConfig } from './mars.config';
import { MarsCatalogService } from './mars-catalog.service';
import type {
  BBox,
  CoverageResult,
  CuratedLayer,
  ImageInfo,
  ProviderDefinition,
  TileCacheInfo,
  TileFetchResult,
  TileModel,
  TileScheme,
  UpstreamInfo,
} from './mars.types';
import {
  clampBBox,
  projectBBox,
  tileBBox,
  tileCenter,
  tileFromLonLat,
  tileGrid,
  tilesForBBox,
  validateTileCoordinates,
} from './tile-math';
import { buildProxyUrl, buildTileUrl } from './tile-url';
import {
  MarsUpstreamError,
  MarsUpstreamService,
  type UpstreamResponse,
} from './upstream.service';

interface CachedTile {
  buffer: Buffer;
  contentType: string;
  upstream: UpstreamResponse;
  image: ImageInfo | null;
  sha256: string;
  etag: string;
  fetchedAt: string;
}

export interface CoverageOptions {
  bbox?: BBox;
  zoom?: number;
  limit?: number;
}

interface ModelExtras {
  fetchedAt: string;
  upstream: UpstreamInfo | null;
  image: ImageInfo | null;
  cache: TileCacheInfo | null;
}

@Injectable()
export class MarsTileService {
  private readonly cache: TtlCache<CachedTile>;

  constructor(
    @Inject(MARS_CONFIG) config: MarsConfig,
    private readonly catalog: MarsCatalogService,
    private readonly upstream: MarsUpstreamService,
  ) {
    // Les tuiles restent servies une semaine après le TTL pendant que la
    // version fraîche se recharge en arrière-plan (stale-while-revalidate).
    this.cache = new TtlCache<CachedTile>(
      config.tileCacheEntries,
      config.tileCacheTtlMs,
      config.tileCacheTtlMs * 7,
    );
  }

  async getTile(
    providerId: string,
    layerId: string,
    zoom: number,
    x: number,
    y: number,
  ): Promise<TileFetchResult> {
    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    const key = this.cacheKey(provider, layer, zoom, x, y);
    const upstreamUrl = buildTileUrl(provider, layer, zoom, x, y);

    let lookup: CacheLookup<CachedTile>;
    try {
      lookup = await this.cache.getOrLoad(key, async () => {
        const response = await this.upstream.fetchBinary(upstreamUrl, {
          accept: layer.format,
        });
        const image = inspectImage(response.buffer);
        const sha256 = image?.sha256 ?? sha256Hex(response.buffer);

        return {
          buffer: response.buffer,
          contentType:
            response.contentType ??
            (image ? `image/${image.format}` : layer.format),
          upstream: response,
          image,
          sha256,
          etag: etagFromSha(sha256),
          fetchedAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      throw this.toHttpError(error);
    }

    const cached = lookup.value;
    const model = this.buildModel(provider, layer, zoom, x, y, {
      fetchedAt: cached.fetchedAt,
      upstream: toUpstreamInfo(cached.upstream),
      image: cached.image,
      cache: {
        hit: lookup.hit,
        stale: lookup.stale,
        key,
        ttlMs: lookup.ttlMs,
        ageMs: lookup.ageMs,
      },
    });

    return {
      model,
      buffer: cached.buffer,
      contentType: cached.contentType,
      etag: cached.etag,
      cacheHit: lookup.hit,
      cacheStale: lookup.stale,
      ttlMs: lookup.ttlMs,
    };
  }

  async describeTile(
    providerId: string,
    layerId: string,
    zoom: number,
    x: number,
    y: number,
    fetch = false,
  ): Promise<TileModel> {
    if (fetch) {
      return (await this.getTile(providerId, layerId, zoom, x, y)).model;
    }

    const { provider, layer } = this.prepare(providerId, layerId, zoom, x, y);
    return this.buildModel(provider, layer, zoom, x, y, {
      fetchedAt: new Date().toISOString(),
      upstream: null,
      image: null,
      cache: null,
    });
  }

  async getTileAt(
    providerId: string,
    layerId: string,
    lon: number,
    lat: number,
    zoom?: number,
    fetch = false,
  ): Promise<TileModel> {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new BadRequestException(
        'Les coordonnées lon et lat doivent être des nombres finis.',
      );
    }

    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    assertTileLayer(provider, layer);

    const targetZoom = zoom ?? layer.maxZoom;
    assertZoom(provider.id, layer.id, targetZoom, layer.minZoom, layer.maxZoom);

    const index = tileFromLonLat(layer.scheme, targetZoom, lon, lat);
    return this.describeTile(
      provider.id,
      layer.id,
      targetZoom,
      index.x,
      index.y,
      fetch,
    );
  }

  coverage(
    providerId: string,
    layerId: string,
    options: CoverageOptions = {},
  ): CoverageResult {
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    assertTileLayer(provider, layer);

    const zoom = options.zoom ?? Math.min(3, layer.maxZoom);
    assertZoom(provider.id, layer.id, zoom, layer.minZoom, layer.maxZoom);

    const bbox = clampBBox(
      options.bbox ?? { west: -180, south: -90, east: 180, north: 90 },
      layer.scheme,
    );
    const range = tilesForBBox(layer.scheme, zoom, bbox);
    const limit = Math.min(Math.max(Math.trunc(options.limit ?? 64), 1), 512);
    const total = (range.maxX - range.minX + 1) * (range.maxY - range.minY + 1);

    const urls: string[] = [];
    const upstreamUrls: string[] = [];

    for (let y = range.minY; y <= range.maxY && urls.length < limit; y += 1) {
      for (let x = range.minX; x <= range.maxX && urls.length < limit; x += 1) {
        urls.push(buildProxyUrl(provider, layer, zoom, x, y));
        upstreamUrls.push(buildTileUrl(provider, layer, zoom, x, y));
      }
    }

    return {
      provider: provider.id,
      layer: layer.id,
      scheme: layer.scheme,
      zoom,
      bbox,
      range,
      count: urls.length,
      total,
      truncated: urls.length < total,
      urls,
      upstreamUrls,
    };
  }

  private prepare(
    providerId: string,
    layerId: string,
    zoom: number,
    x: number,
    y: number,
  ): {
    provider: ProviderDefinition;
    layer: CuratedLayer & { scheme: TileScheme };
  } {
    const { provider, layer } = this.catalog.getLayer(providerId, layerId);
    assertTileLayer(provider, layer);

    const problem = validateTileCoordinates(
      provider.id,
      layer.id,
      layer.scheme,
      zoom,
      x,
      y,
      { minZoom: layer.minZoom, maxZoom: layer.maxZoom },
    );

    if (problem) {
      throw new BadRequestException(problem);
    }

    return { provider, layer };
  }

  private buildModel(
    provider: ProviderDefinition,
    layer: CuratedLayer & { scheme: TileScheme },
    zoom: number,
    x: number,
    y: number,
    extras: ModelExtras,
  ): TileModel {
    const bbox = tileBBox(layer.scheme, zoom, x, y);
    const grid = tileGrid(layer.scheme, zoom);

    return {
      provider: {
        id: provider.id,
        name: provider.name,
        kind: provider.kind,
      },
      layer: {
        id: layer.id,
        title: layer.title,
        upstreamLayer: layer.upstreamLayer,
      },
      scheme: layer.scheme,
      crs: layer.crs,
      zoom,
      x,
      y,
      tileSize: layer.tileSize,
      format: layer.format,
      bbox,
      projectedBBox: projectBBox(layer.scheme, bbox, layer.crs),
      center: tileCenter(layer.scheme, bbox),
      tileRange: { maxX: grid.columns - 1, maxY: grid.rows - 1 },
      upstreamUrl: buildTileUrl(provider, layer, zoom, x, y),
      proxyUrl: buildProxyUrl(provider, layer, zoom, x, y),
      attribution: layer.attribution,
      license: layer.license,
      fetchedAt: extras.fetchedAt,
      upstream: extras.upstream,
      image: extras.image,
      cache: extras.cache,
    };
  }

  private cacheKey(
    provider: ProviderDefinition,
    layer: CuratedLayer,
    zoom: number,
    x: number,
    y: number,
  ): string {
    return `${provider.id}:${layer.id}:${zoom}:${x}:${y}`;
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof MarsUpstreamError) {
      if (error.status === 404) {
        return new NotFoundException(
          'La tuile demandée n’existe pas sur le service amont (404).',
        );
      }
      return new BadGatewayException(`Tuile indisponible : ${error.message}`);
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

function assertTileLayer(
  provider: ProviderDefinition,
  layer: CuratedLayer,
): asserts layer is CuratedLayer & { scheme: TileScheme } {
  if (layer.scheme === 'none' || layer.kind === '3d-tiles') {
    throw new BadRequestException(
      `${provider.id}/${layer.id} est un jeu 3D Tiles : consultez /mars/providers/${provider.id}/tileset.`,
    );
  }
}

function assertZoom(
  providerId: string,
  layerId: string,
  zoom: number,
  minZoom: number,
  maxZoom: number,
): void {
  if (!Number.isInteger(zoom) || zoom < minZoom || zoom > maxZoom) {
    throw new BadRequestException(
      `Zoom ${zoom} hors plage pour ${providerId}/${layerId} (${minZoom}–${maxZoom}).`,
    );
  }
}

function toUpstreamInfo(response: UpstreamResponse): UpstreamInfo {
  return {
    status: response.status,
    contentType: response.contentType,
    contentLength: response.contentLength,
    etag: response.etag,
    lastModified: response.lastModified,
    cacheControl: response.cacheControl,
  };
}
