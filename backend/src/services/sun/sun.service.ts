import {
  BadGatewayException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  buildSolarQueryUrl,
  interpolateSolarSample,
  parseHorizonsSolarTable,
  toEastPositive,
} from './horizons';
import {
  SUN_BODIES,
  type SunBody,
  type SunEphemeris,
  type SunSample,
} from './sun.types';

const HOUR_MS = 60 * 60 * 1_000;
const DEFAULT_TTL_MS = 6 * HOUR_MS;
const WINDOW_PAST_MS = 2 * HOUR_MS;
const WINDOW_FUTURE_MS = 22 * HOUR_MS;
const DEFAULT_TIMEOUT_MS = 20_000;

export const SUN_SERVICE_OPTIONS = Symbol('SUN_SERVICE_OPTIONS');

export interface SunServiceOptions {
  now?: () => number;
  ttlMs?: number;
  upstreamTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface CacheEntry {
  body: SunBody;
  samples: SunSample[];
  generatedAt: string;
  expiresAt: string;
  fetchedAt: number;
  source: SunEphemeris['source'];
  frame: SunEphemeris['frame'];
}

@Injectable()
export class SunService {
  private readonly cache = new Map<SunBody, CacheEntry>();
  private readonly inFlight = new Map<SunBody, Promise<CacheEntry>>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly upstreamTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(
    @Optional()
    @Inject(SUN_SERVICE_OPTIONS)
    options: SunServiceOptions = {},
  ) {
    this.now = options.now ?? (() => Date.now());
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.upstreamTimeoutMs = options.upstreamTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async get(body: SunBody): Promise<SunEphemeris> {
    const cached = this.cache.get(body);
    if (cached && this.now() - cached.fetchedAt < this.ttlMs) {
      return this.present(cached, false);
    }

    try {
      return this.present(await this.refresh(body), false);
    } catch (error) {
      if (cached) {
        return this.present(cached, true);
      }
      const reason = error instanceof Error ? error.message : String(error);
      throw new BadGatewayException(
        `Éphéméride solaire JPL Horizons indisponible : ${reason}`,
      );
    }
  }

  private refresh(body: SunBody): Promise<CacheEntry> {
    const running = this.inFlight.get(body);
    if (running) {
      return running;
    }

    const request = this.fetchEphemeris(body).finally(() => {
      this.inFlight.delete(body);
    });
    this.inFlight.set(body, request);
    return request;
  }

  private async fetchEphemeris(body: SunBody): Promise<CacheEntry> {
    const definition = SUN_BODIES[body];
    const nowMs = this.now();
    const start = new Date(nowMs - WINDOW_PAST_MS);
    const stop = new Date(nowMs + WINDOW_FUTURE_MS);
    const url = buildSolarQueryUrl(definition.horizonsId, start, stop);

    const response = await this.fetchImpl(url, {
      headers: {
        accept: 'text/plain',
        'user-agent': 'space-backend-sun/1.0 (+https://nestjs.com)',
      },
      signal: AbortSignal.timeout(this.upstreamTimeoutMs),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} depuis JPL Horizons`);
    }

    const text = await response.text();
    const table = parseHorizonsSolarTable(text);
    if (table.rows.length < 2) {
      throw new Error('JPL Horizons a renvoyé moins de deux échantillons.');
    }

    const generatedAt = new Date(nowMs).toISOString();
    const entry: CacheEntry = {
      body,
      samples: table.rows.map((row) => ({
        time: row.time,
        lon: toEastPositive(row.lon, table.westPositive),
        lat: row.lat,
      })),
      generatedAt,
      expiresAt: new Date(nowMs + this.ttlMs).toISOString(),
      fetchedAt: nowMs,
      source: {
        name: 'NASA/JPL Horizons API',
        dataset: table.dataset ?? 'DE441',
        quantity: 'SunSub-LON / SunSub-LAT (quantity 15)',
        url: url.toString(),
      },
      frame: {
        reference: definition.frame,
        longitude: 'east-positive',
        latitude: 'body-fixed',
      },
    };

    this.cache.set(body, entry);
    return entry;
  }

  private present(entry: CacheEntry, stale: boolean): SunEphemeris {
    const nowMs = this.now();
    return {
      body: entry.body,
      now: new Date(nowMs).toISOString(),
      generatedAt: entry.generatedAt,
      expiresAt: entry.expiresAt,
      stale,
      source: entry.source,
      frame: entry.frame,
      samples: entry.samples,
      current: interpolateSolarSample(entry.samples, nowMs),
    };
  }
}
