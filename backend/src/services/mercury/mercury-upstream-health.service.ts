import { Injectable } from '@nestjs/common';
import { MercuryCatalogService } from './mercury-catalog.service';
import type {
  HealthProviderResult,
  HealthReport,
  ProviderDefinition,
} from './mercury.types';
import { buildTileUrl } from './tile-url';
import { MercuryUpstreamService, type UpstreamProbe } from './upstream.service';

@Injectable()
export class MercuryHealthService {
  constructor(
    private readonly catalog: MercuryCatalogService,
    private readonly upstream: MercuryUpstreamService,
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
    const layer = provider.layers[0];
    if (!layer) {
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
