import {
  BadGatewayException,
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TtlCache } from './cache';
import { MARS_CONFIG, type MarsConfig } from './mars.config';
import { MarsCatalogService } from './mars-catalog.service';
import type { ProviderDefinition, TilesetSummary } from './mars.types';
import {
  MarsUpstreamError,
  MarsUpstreamService,
  type UpstreamJsonResponse,
} from './upstream.service';

interface CesiumEndpoint {
  type?: string;
  url?: string;
  accessToken?: string;
  attributions?: unknown;
}

interface CesiumTilesetJson {
  asset?: {
    version?: string;
    tilesetVersion?: string;
    generator?: string;
  };
  geometricError?: number;
  root?: {
    geometricError?: number;
    refine?: string;
    boundingVolume?: unknown;
    children?: unknown[];
  };
  extensionsUsed?: unknown;
  extensionsRequired?: unknown;
}

const CESIUM_ENDPOINT_BASE = 'https://api.cesium.com/v1/assets';

@Injectable()
export class MarsTilesetService {
  private readonly cache: TtlCache<TilesetSummary>;

  constructor(
    @Inject(MARS_CONFIG) private readonly config: MarsConfig,
    private readonly catalog: MarsCatalogService,
    private readonly upstream: MarsUpstreamService,
  ) {
    this.cache = new TtlCache<TilesetSummary>(
      4,
      Math.min(config.capabilitiesCacheTtlMs, 600_000),
    );
  }

  async getTileset(providerId: string): Promise<TilesetSummary> {
    const provider = this.catalog.getProvider(providerId);

    if (provider.kind !== '3d-tiles') {
      throw new BadRequestException(
        `${provider.id} ne fournit pas de jeu 3D Tiles.`,
      );
    }

    const layer = provider.layers.find(
      (entry) => entry.kind === '3d-tiles' && entry.tiles3d,
    );
    const tiles3d = layer?.tiles3d;
    if (!tiles3d) {
      throw new NotFoundException(
        `Aucun jeu 3D Tiles n’est configuré pour ${provider.id}.`,
      );
    }

    const token = this.config.cesiumToken;
    if (!token) {
      throw new ServiceUnavailableException(
        'CESIUM_ION_TOKEN n’est pas configuré : le jeu Cesium Mars est indisponible.',
      );
    }

    try {
      const lookup = await this.cache.getOrLoad(provider.id, () =>
        this.load(provider, tiles3d.assetId, token),
      );
      return lookup.value;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async load(
    provider: ProviderDefinition,
    assetId: number,
    token: string,
  ): Promise<TilesetSummary> {
    const endpointUrl = `${CESIUM_ENDPOINT_BASE}/${assetId}/endpoint`;
    const endpoint = await this.upstream.fetchJson<CesiumEndpoint>(
      endpointUrl,
      { token },
    );

    const assetUrl =
      typeof endpoint.data.url === 'string'
        ? endpoint.data.url.replace(/\/+$/, '')
        : null;

    if (!assetUrl) {
      throw new MarsUpstreamError(
        'Cesium ion n’a pas renvoyé d’URL de jeu de tuiles.',
        502,
        endpointUrl,
      );
    }

    const accessToken =
      typeof endpoint.data.accessToken === 'string'
        ? endpoint.data.accessToken
        : token;
    const tilesetUrl = `${assetUrl}/tileset.json?access_token=${encodeURIComponent(accessToken)}`;

    let tileset: UpstreamJsonResponse<CesiumTilesetJson>;
    try {
      tileset = await this.upstream.fetchJson<CesiumTilesetJson>(tilesetUrl, {
        timeoutMs: this.config.httpTimeoutMs,
        accept: 'application/json',
      });
    } catch (error) {
      if (error instanceof MarsUpstreamError) {
        throw new MarsUpstreamError(error.message, error.status, assetUrl);
      }
      throw error;
    }

    const document = tileset.data;
    const asset = document.asset ?? {};
    const root = document.root ?? {};
    const descendants = countDescendants(root, 20_000);

    return {
      provider: provider.id,
      assetId,
      requiresToken: true,
      endpointUrl: assetUrl,
      attributions: normalizeAttributions(endpoint.data.attributions),
      asset: {
        version: asString(asset.version),
        tilesetVersion: asString(asset.tilesetVersion),
        generator: asString(asset.generator),
      },
      root: {
        geometricError: asNumber(root.geometricError),
        refine: asString(root.refine),
        boundingVolume: asRecord(root.boundingVolume),
        descendantCount: descendants.count,
        truncated: descendants.truncated,
      },
      geometricError: asNumber(document.geometricError),
      extensionsUsed: asStringArray(document.extensionsUsed),
      extensionsRequired: asStringArray(document.extensionsRequired),
      fetchedAt: new Date().toISOString(),
    };
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof MarsUpstreamError) {
      if (error.status === 401 || error.status === 403) {
        return new BadGatewayException(
          'Cesium ion a refusé le token : vérifiez CESIUM_ION_TOKEN.',
        );
      }
      if (error.status === 404) {
        return new BadGatewayException(
          'Le jeu Cesium Mars est introuvable (404).',
        );
      }
      return new BadGatewayException(
        `Jeu 3D Tiles indisponible : ${error.message}`,
      );
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}

function countDescendants(
  root: CesiumTilesetJson['root'],
  limit: number,
): { count: number; truncated: boolean } {
  const stack: unknown[] = [];
  if (root && Array.isArray(root.children)) {
    stack.push(...root.children);
  }

  let count = 0;
  while (stack.length > 0) {
    if (count >= limit) {
      return { count, truncated: true };
    }

    const node = stack.pop();
    count += 1;

    if (isRecord(node) && Array.isArray(node.children)) {
      stack.push(...node.children);
    }
  }

  return { count, truncated: false };
}

function normalizeAttributions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const attributions: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      attributions.push(entry);
    } else if (isRecord(entry) && typeof entry.html === 'string') {
      attributions.push(entry.html);
    }
  }

  return attributions;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
