import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { MoonPhasesDto } from '../../dto/ephemeris.dto';

const TTL_MS = 6 * 3_600_000;
const TIMEOUT_MS = 15_000;
const PHASE_FR: Record<string, string> = {
  'New Moon': 'Nouvelle lune', 'First Quarter': 'Premier quartier', 'Full Moon': 'Pleine lune', 'Last Quarter': 'Dernier quartier',
};

interface UsnoPhase { year: number; month: number; day: number; time: string; phase: string }

/**
 * Prochaines phases principales de la Lune (U.S. Naval Observatory, API publique sans clé :
 * https://aa.usno.navy.mil/data/api). Heures en temps universel. Gardées 6 h en mémoire.
 */
@Injectable()
export class UsnoService {
  private cache: { at: number; data: Promise<MoonPhasesDto> } | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  phases(): Promise<MoonPhasesDto> {
    const now = this.now();
    if (this.cache && now - this.cache.at < TTL_MS) return this.cache.data;
    const data = this.load(now).catch((e) => { if (this.cache?.data === data) this.cache = null; throw e; });
    this.cache = { at: now, data };
    return data;
  }

  private async load(now: number): Promise<MoonPhasesDto> {
    const date = new Date(now).toISOString().slice(0, 10);
    const url = `${this.config.usno.url}/moon/phases/date?date=${date}&nump=4`;
    let body: { phasedata?: UsnoPhase[]; error?: string };
    try {
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as typeof body;
    } catch (e) {
      throw new BadGatewayException(`USNO injoignable : ${(e as Error).message}`);
    }
    if (body.error || !Array.isArray(body.phasedata)) throw new BadGatewayException(`USNO : ${body.error ?? 'réponse inattendue'}`);
    return {
      source: 'U.S. Naval Observatory (aa.usno.navy.mil)',
      items: body.phasedata.map((p) => {
        const [h, m] = p.time.split(':').map(Number);
        return { phase: PHASE_FR[p.phase] ?? p.phase, utc: new Date(Date.UTC(p.year, p.month - 1, p.day, h, m)).toISOString() };
      }),
    };
  }
}
