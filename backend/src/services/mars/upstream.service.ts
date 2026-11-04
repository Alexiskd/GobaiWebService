import { Buffer } from 'node:buffer';
import { Inject, Injectable } from '@nestjs/common';
import { MARS_CONFIG, type MarsConfig } from './mars.config';

export interface UpstreamRequestOptions {
  timeoutMs?: number;
  maxBytes?: number;
  accept?: string;
  headers?: Record<string, string>;
}

export interface UpstreamResponse {
  url: string;
  status: number;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  cacheControl: string | null;
  buffer: Buffer;
  bytes: number;
  durationMs: number;
}

export interface UpstreamJsonResponse<T> extends UpstreamResponse {
  data: T;
}

export interface UpstreamProbe {
  url: string;
  status: number | null;
  ok: boolean;
  contentType: string | null;
  latencyMs: number;
  error: string | null;
}

export interface UpstreamProbeOptions {
  timeoutMs?: number;
  accept?: string;
  headers?: Record<string, string>;
}

export class MarsUpstreamError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
    this.name = 'MarsUpstreamError';
  }
}

@Injectable()
export class MarsUpstreamService {
  constructor(@Inject(MARS_CONFIG) private readonly config: MarsConfig) {}

  async fetchBinary(
    url: string,
    options: UpstreamRequestOptions = {},
  ): Promise<UpstreamResponse> {
    const response = await this.request(url, options);
    return this.readBody(response, url, options);
  }

  async fetchText(
    url: string,
    options: UpstreamRequestOptions = {},
  ): Promise<UpstreamResponse & { text: string }> {
    const result = await this.fetchBinary(url, options);
    return { ...result, text: result.buffer.toString('utf8') };
  }

  async fetchJson<T>(
    url: string,
    options: UpstreamRequestOptions & { token?: string } = {},
  ): Promise<UpstreamJsonResponse<T>> {
    const headers = { ...options.headers };
    if (options.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    const result = await this.fetchBinary(url, {
      ...options,
      headers,
      accept: options.accept ?? 'application/json',
    });

    try {
      const data = JSON.parse(result.buffer.toString('utf8')) as T;
      return { ...result, data };
    } catch {
      throw new MarsUpstreamError(
        'La réponse amont n’est pas un JSON valide.',
        502,
        url,
      );
    }
  }

  async probe(
    url: string,
    options: UpstreamProbeOptions = {},
  ): Promise<UpstreamProbe> {
    const timeoutMs = options.timeoutMs ?? this.config.healthTimeoutMs;
    const startedAt = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': this.config.userAgent,
          accept: options.accept ?? '*/*',
          ...options.headers,
        },
      });

      await response.body?.cancel();

      return {
        url,
        status: response.status,
        ok: response.ok,
        contentType: normalizeHeader(response.headers.get('content-type')),
        latencyMs: Date.now() - startedAt,
        error: response.ok ? null : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        url,
        status: null,
        ok: false,
        contentType: null,
        latencyMs: Date.now() - startedAt,
        error: describeFetchError(error),
      };
    }
  }

  private async request(
    url: string,
    options: UpstreamRequestOptions,
  ): Promise<Response> {
    const timeoutMs = options.timeoutMs ?? this.config.httpTimeoutMs;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'user-agent': this.config.userAgent,
          accept: options.accept ?? '*/*',
          ...options.headers,
        },
      });
    } catch (error) {
      throw new MarsUpstreamError(
        `Requête amont impossible : ${describeFetchError(error)}`,
        error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
        url,
      );
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new MarsUpstreamError(
        `Le service amont a répondu HTTP ${response.status}.`,
        response.status,
        url,
      );
    }

    return response;
  }

  private async readBody(
    response: Response,
    url: string,
    options: UpstreamRequestOptions,
  ): Promise<UpstreamResponse> {
    const maxBytes = options.maxBytes ?? this.config.maxUpstreamBytes;
    const contentLength = readContentLength(
      response.headers.get('content-length'),
    );

    if (contentLength !== null && contentLength > maxBytes) {
      await response.body?.cancel();
      throw new MarsUpstreamError(
        `Réponse amont trop volumineuse (${contentLength} octets, limite ${maxBytes}).`,
        502,
        url,
      );
    }

    const startedAt = Date.now();
    const buffer = Buffer.from(await response.arrayBuffer());
    const durationMs = Date.now() - startedAt;

    if (buffer.length > maxBytes) {
      throw new MarsUpstreamError(
        `Réponse amont trop volumineuse (${buffer.length} octets, limite ${maxBytes}).`,
        502,
        url,
      );
    }

    return {
      url,
      status: response.status,
      contentType: normalizeHeader(response.headers.get('content-type')),
      contentLength,
      etag: normalizeHeader(response.headers.get('etag')),
      lastModified: normalizeHeader(response.headers.get('last-modified')),
      cacheControl: normalizeHeader(response.headers.get('cache-control')),
      buffer,
      bytes: buffer.length,
      durationMs,
    };
  }
}

function normalizeHeader(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readContentLength(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function describeFetchError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return 'délai d’attente dépassé';
    }
    return error.message;
  }

  return String(error);
}
