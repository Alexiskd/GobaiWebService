import { Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { MoonOrbiterDto, MoonOrbitersDto } from '../../dto/ephemeris.dto';
import { parseVectorTable, vectorQueryString } from './horizons';

const MIN = 60_000;
const HOUR = 60 * MIN;
const WINDOW_BEFORE_MS = 30 * MIN;
const WINDOW_AFTER_MS = 6 * HOUR;
const STEP_MIN = 2; // LRO fait le tour en ≈ 2 h : 2 min suffisent à l'interpolation (erreur de quelques mètres)
const TIMEOUT_MS = 20_000;

/** Sondes en orbite lunaire suivies, avec leur identifiant JPL Horizons. */
export const MOON_ORBITERS = [
  { id: 'lro', horizonsId: '-85', name: 'LRO', agency: 'NASA', description: 'Lunar Reconnaissance Orbiter (2009), cartographie de la Lune' },
  { id: 'chandrayaan-2', horizonsId: '-152', name: 'Chandrayaan-2', agency: 'ISRO', description: 'Orbiteur indien (2019)' },
  { id: 'danuri', horizonsId: '-155', name: 'Danuri (KPLO)', agency: 'KARI', description: 'Korea Pathfinder Lunar Orbiter (2022)' },
  { id: 'capstone', horizonsId: '-1176', name: 'CAPSTONE', agency: 'NASA', description: 'Orbite de halo quasi rectiligne (NRHO), 2022' },
] as const;

const hz = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

/**
 * Positions réelles des sondes en orbite autour de la Lune (JPL Horizons), centre de la Lune (500@301), écliptique
 * J2000, km. Table de 6 h 30 au pas de 2 min, gardée en mémoire et redemandée quand il reste moins de 2 h.
 * Une sonde sans éphéméride à jour (mission terminée, données pas encore publiées) est signalée sans bloquer les autres.
 */
@Injectable()
export class OrbitersService {
  private cache: { from: number; to: number; data: Promise<MoonOrbitersDto>; failed?: number } | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {}

  orbiters(): Promise<MoonOrbitersDto> {
    const now = this.now();
    const c = this.cache;
    // Tout en échec (Horizons injoignable) : nouvel essai au bout de 5 min.
    const retry = c?.failed !== undefined && now - c.failed > 5 * MIN;
    if (c && !retry && now >= c.from && c.to - now > 2 * HOUR) return c.data;
    const from = Math.floor((now - WINDOW_BEFORE_MS) / MIN) * MIN;
    const to = from + WINDOW_BEFORE_MS + WINDOW_AFTER_MS;
    const entry: { from: number; to: number; data: Promise<MoonOrbitersDto>; failed?: number } = { from, to, data: this.load(from, to) };
    entry.data.then((r) => { if (r.items.every((i) => i.status === 'error')) entry.failed = this.now(); });
    this.cache = entry;
    return entry.data;
  }

  private async load(from: number, to: number): Promise<MoonOrbitersDto> {
    const items = await Promise.all(MOON_ORBITERS.map((o) => this.one(o, from, to)));
    return {
      source: 'JPL Horizons (NASA/JPL-Caltech), vecteurs géométriques',
      center: 'Centre de la Lune (500@301)',
      frame: 'Écliptique J2000 (ICRF)',
      unit: 'km',
      stepMinutes: STEP_MIN,
      items,
    };
  }

  private async one(o: (typeof MOON_ORBITERS)[number], from: number, to: number): Promise<MoonOrbiterDto> {
    const base = { id: o.id, name: o.name, agency: o.agency, description: o.description, horizonsId: o.horizonsId };
    const q = vectorQueryString({ command: o.horizonsId, center: '500@301', start: hz(from), stop: hz(to), step: `${STEP_MIN} m` });
    try {
      const res = await this.fetchFn(`${this.config.horizons.url}?${q}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { result?: string; error?: string };
      if (body.error) throw new Error(body.error);
      const points = parseVectorTable(body.result ?? '');
      if (points.length < 4) throw new Error('pas d’éphéméride sur cette période');
      return { ...base, status: 'ok', points };
    } catch (e) {
      const msg = (e as Error).message.split('\n').find((l) => l.trim()) ?? 'erreur';
      return { ...base, status: 'error', error: `JPL Horizons : ${msg.trim().slice(0, 200)}`, points: [] };
    }
  }
}
