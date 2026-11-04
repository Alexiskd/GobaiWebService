import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { MoonEphemerisDto } from '../../dto/ephemeris.dto';
import { parseVectorTable, vectorQueryString } from './horizons';

const HOUR = 3_600_000;
const WINDOW_BEFORE_MS = 2 * HOUR;
const WINDOW_AFTER_MS = 48 * HOUR;
const STEP_MIN = 30;
const TIMEOUT_MS = 20_000;

/** 'YYYY-MM-DD HH:MM' (UTC), format de dates accepté par Horizons. */
const hz = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

/**
 * Position exacte de la Lune (centre de la Terre → centre de la Lune) depuis l'API JPL Horizons (éphémérides DE),
 * dans l'écliptique J2000 comme les planètes du moteur. Une table de 50 h au pas de 30 min est demandée puis gardée en
 * mémoire : le client l'interpole à chaque image. Nouvelle demande quand il reste moins de 24 h de données.
 */
@Injectable()
export class HorizonsService {
  private cache: { from: number; to: number; data: Promise<MoonEphemerisDto> } | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  moon(): Promise<MoonEphemerisDto> {
    const now = this.now();
    const c = this.cache;
    if (c && now >= c.from && c.to - now > 24 * HOUR) return c.data;
    const from = Math.floor((now - WINDOW_BEFORE_MS) / HOUR) * HOUR;
    const to = from + WINDOW_BEFORE_MS + WINDOW_AFTER_MS;
    const data = this.load(from, to).catch((e) => {
      if (this.cache?.data === data) this.cache = null;
      throw e;
    });
    this.cache = { from, to, data };
    return data;
  }

  private async load(from: number, to: number): Promise<MoonEphemerisDto> {
    // La Lune (301) vue du centre de la Terre (500@399), écliptique J2000, positions géométriques.
    const q = vectorQueryString({ command: '301', center: '500@399', start: hz(from), stop: hz(to), step: `${STEP_MIN} m` });
    let body: { result?: string; error?: string };
    try {
      const res = await this.fetchFn(`${this.config.horizons.url}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as { result?: string; error?: string };
    } catch (e) {
      throw new BadGatewayException(`JPL Horizons injoignable : ${(e as Error).message}`);
    }
    if (body.error) throw new BadGatewayException(`JPL Horizons : ${body.error}`);
    let points;
    try {
      points = parseVectorTable(body.result ?? '');
    } catch (e) {
      throw new BadGatewayException(`JPL Horizons : ${(e as Error).message}`);
    }
    if (points.length < 4) throw new BadGatewayException('JPL Horizons : table trop courte.');
    return {
      source: 'JPL Horizons (NASA/JPL-Caltech), vecteurs géométriques',
      target: 'Lune (301)',
      center: 'Centre de la Terre (500@399)',
      frame: 'Écliptique J2000 (ICRF)',
      unit: 'km',
      stepMinutes: STEP_MIN,
      points,
    };
  }
}
