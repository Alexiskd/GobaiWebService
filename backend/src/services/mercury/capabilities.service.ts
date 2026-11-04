import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import {
  CapabilitiesParseError,
  parseCapabilities,
} from './capabilities.parser';
import { TtlCache } from './cache';
import { MERCURY_CONFIG, type MercuryConfig } from './mercury.config';
import { MercuryCatalogService } from './mercury-catalog.service';
import type {
  CapabilitiesResult,
  CapabilitiesSummary,
  ProviderDefinition,
} from './mercury.types';
import { MercuryUpstreamError, MercuryUpstreamService } from './upstream.service';

interface CapabilitiesDocument {
  summary: CapabilitiesSummary;
  raw: string | null;
}

export interface CapabilitiesOptions {
  raw?: boolean;
  refresh?: boolean;
}

@Injectable()
export class MercuryCapabilitiesService {
  private readonly cache: TtlCache<CapabilitiesDocument>;

  constructor(
    @Inject(MERCURY_CONFIG) config: MercuryConfig,
    private readonly catalog: MercuryCatalogService,
    private readonly upstream: MercuryUpstreamService,
  ) {
    this.cache = new TtlCache<CapabilitiesDocument>(
      8,
      config.capabilitiesCacheTtlMs,
    );
  }

  async getCapabilities(
    providerId: string,
    options: CapabilitiesOptions = {},
  ): Promise<CapabilitiesResult> {
    const provider = this.catalog.getProvider(providerId);

    if (provider.kind === 'xyz') {
      return { summary: this.syntheticSummary(provider), raw: null };
    }

    if (!provider.capabilitiesUrl) {
      throw new BadGatewayException(
        `Aucune URL GetCapabilities n’est configurée pour ${provider.id}.`,
      );
    }

    try {
      const lookup = options.refresh
        ? await this.loadAndStore(provider)
        : await this.cache.getOrLoad(provider.id, () =>
            this.load(provider, provider.capabilitiesUrl as string),
          );

      return {
        summary: lookup.value.summary,
        raw: options.raw ? lookup.value.raw : null,
      };
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  private async loadAndStore(provider: ProviderDefinition) {
    const document = await this.load(
      provider,
      provider.capabilitiesUrl as string,
    );
    this.cache.set(provider.id, document);
    return {
      value: document,
      hit: false,
      ageMs: 0,
      ttlMs: this.cache.ttl,
    };
  }

  private async load(
    provider: ProviderDefinition,
    capabilitiesUrl: string,
  ): Promise<CapabilitiesDocument> {
    const startedAt = Date.now();
    const response = await this.upstream.fetchText(capabilitiesUrl, {
      accept: 'application/xml, text/xml, */*',
    });
    const fetchMs = Date.now() - startedAt;
    const parsed = parseCapabilities(response.text);

    return {
      summary: {
        provider: provider.id,
        kind: provider.kind,
        version: parsed.version,
        serviceTitle: parsed.serviceTitle ?? provider.name,
        fetchedAt: new Date().toISOString(),
        bytes: response.bytes,
        contentType: response.contentType,
        fetchMs,
        formats: parsed.formats,
        crs: parsed.crs,
        bbox: parsed.bbox,
        layers: parsed.layers,
        tileMatrixSets: parsed.tileMatrixSets,
        resourceUrlTemplate: parsed.resourceUrlTemplate,
      },
      raw: response.text,
    };
  }

  private syntheticSummary(provider: ProviderDefinition): CapabilitiesSummary {
    const layer = provider.layers[0];

    return {
      provider: provider.id,
      kind: provider.kind,
      version: null,
      serviceTitle: provider.name,
      fetchedAt: new Date().toISOString(),
      bytes: null,
      contentType: null,
      fetchMs: null,
      formats: layer ? [layer.format] : [],
      crs: layer ? [layer.crs] : [],
      bbox: { west: -180, south: -90, east: 180, north: 90 },
      layers: provider.layers.map((entry) => ({
        name: entry.upstreamLayer,
        title: entry.title,
      })),
      tileMatrixSets: [],
      resourceUrlTemplate: layer?.xyz?.urlTemplate ?? null,
      note: 'OPM est servi en tuiles XYZ : aucun document GetCapabilities OGC n’est exposé.',
    };
  }

  private toHttpError(error: unknown): Error {
    if (error instanceof CapabilitiesParseError) {
      return new BadGatewayException(
        `Capacités OGC illisibles : ${error.message}`,
      );
    }

    if (error instanceof MercuryUpstreamError) {
      return new BadGatewayException(
        `Capacités OGC indisponibles : ${error.message}`,
      );
    }

    return error instanceof Error ? error : new Error(String(error));
  }
}
