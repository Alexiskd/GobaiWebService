import { Inject, Injectable } from '@nestjs/common';
import { MOON_CONFIG, type MoonConfig } from './moon.config';
import { MoonCatalogService } from './moon-catalog.service';
import type {
  HealthProviderResult,
  HealthReport,
  ProviderDefinition,
} from './moon.types';
import { buildTileUrl } from './tile-url';
import { MoonUpstreamService, type UpstreamProbe } from './upstream.service';

const CESIUM_ENDPOINT_BASE = 'https://api.cesium.com/v1/assets';

@Injectable()
export class MoonHealthService {
  constructor(
    @Inject(MOON_CONFIG) private readonly config: MoonConfig,
    private readonly catalog: MoonCatalogService,
    private readonly upstream: MoonUpstreamService,
  ) {}

  async check(): Promise<HealthReport> {
    const providers = await Promise.all(
      this.catalog
        .listProviders()
        .map((provider) => this.checkProvider(provider)),
    );

    const summary = { up: 0, degraded: 0, down: 0, notConfigured: 0 };
    for (const provider of providers) {
      if (provider.status === 'up') {
        summary.up += 1;
      } else if (provider.status === 'degraded') {
        summary.degraded += 1;
      } else if (provider.status === 'down') {
        summary.down += 1;
      } else {
        summary.notConfigured += 1;
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      summary,
      providers,
    };
  }

  private async checkProvider(
    provider: ProviderDefinition,
  ): Promise<HealthProviderResult> {
    if (provider.kind === '3d-tiles') {
      return this.checkCesium(provider);
    }

    const layer = provider.layers.find((entry) => entry.scheme !== 'none');
    if (!layer || layer.scheme === 'none') {
      return {
        provider: provider.id,
        kind: provider.kind,
        status: 'down',
        httpStatus: null,
        latencyMs: 0,
        contentType: null,
        error: 'Aucune couche 2D configurée.',
      };
    }

    const url = buildTileUrl(provider, layer, layer.minZoom, 0, 0);
    const probe = await this.upstream.probe(url, { accept: layer.format });
    return toHealthResult(provider.id, provider.kind, probe);
  }

  private async checkCesium(
    provider: ProviderDefinition,
  ): Promise<HealthProviderResult> {
    const token = this.config.cesiumToken;
    if (!token) {
      return {
        provider: provider.id,
        kind: provider.kind,
        status: 'not_configured',
        httpStatus: null,
        latencyMs: 0,
        contentType: null,
        error: 'CESIUM_ION_TOKEN absent.',
      };
    }

    const url = `${CESIUM_ENDPOINT_BASE}/${this.config.cesiumAssetId}/endpoint`;
    const probe = await this.upstream.probe(url, {
      accept: 'application/json',
      headers: { Authorization: `Bearer ${token}` },
    });

    return toHealthResult(provider.id, provider.kind, probe);
  }
}

function toHealthResult(
  provider: HealthProviderResult['provider'],
  kind: HealthProviderResult['kind'],
  probe: UpstreamProbe,
): HealthProviderResult {
  let status: HealthProviderResult['status'];
  if (probe.ok) {
    status = 'up';
  } else if (
    probe.status === 401 ||
    probe.status === 403 ||
    probe.status === 429
  ) {
    status = 'degraded';
  } else {
    status = 'down';
  }

  return {
    provider,
    kind,
    status,
    httpStatus: probe.status,
    latencyMs: probe.latencyMs,
    contentType: probe.contentType,
    error: probe.error,
  };
}
