import { BadGatewayException, Inject, Injectable } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { CityLabelsDto } from '../../dto/places.dto';

const TIMEOUT_MS = 45_000;   // le GeoJSON complet pèse ≈ 19 Mo
const round = (v: number) => Math.round(v * 10000) / 10000;

// Écriture dominante de chaque pays (ISO A2) et champ Natural Earth correspondant. Les pays absents
// restent en caractères latins : soit l'écriture est latine, soit Natural Earth ne fournit pas le nom
// local (thaï, tamoul, géorgien, amharique, khmer…). Le persan et l'ourdou s'écrivent en arabe.
const LOCAL_SCRIPTS: { field: string; script: string; countries: string[] }[] = [
  { field: 'NAME_JA', script: 'japanese', countries: ['JP'] },
  { field: 'NAME_KO', script: 'korean', countries: ['KR', 'KP'] },
  { field: 'NAME_ZH', script: 'chinese', countries: ['CN'] },
  { field: 'NAME_ZHT', script: 'chinese', countries: ['TW', 'HK', 'MO'] },
  { field: 'NAME_AR', script: 'arabic', countries: [
    'EG', 'SA', 'AE', 'DZ', 'MA', 'TN', 'LY', 'SD', 'IQ', 'SY', 'JO', 'LB', 'KW', 'QA', 'BH',
    'OM', 'YE', 'MR', 'PS', 'EH', 'DJ', 'SO', 'KM',
  ] },
  { field: 'NAME_FA', script: 'arabic', countries: ['IR', 'AF'] },
  { field: 'NAME_UR', script: 'arabic', countries: ['PK'] },
  { field: 'NAME_HE', script: 'hebrew', countries: ['IL'] },
  { field: 'NAME_HI', script: 'devanagari', countries: ['IN'] },
  { field: 'NAME_BN', script: 'bengali', countries: ['BD'] },
  { field: 'NAME_EL', script: 'greek', countries: ['GR', 'CY'] },
  { field: 'NAME_RU', script: 'cyrillic', countries: ['RU'] },
  { field: 'NAME_UK', script: 'cyrillic', countries: ['UA'] },
];
const SCRIPT_BY_COUNTRY = new Map<string, { field: string; script: string }>();
for (const { field, script, countries } of LOCAL_SCRIPTS) {
  for (const iso of countries) SCRIPT_BY_COUNTRY.set(iso, { field, script });
}
const COUNTRY_NAMES_FR = new Intl.DisplayNames(['fr'], { type: 'region' });

type NeProperties = Record<string, unknown>;

interface NeFeature {
  geometry?: { type?: string; coordinates?: [number, number] };
  properties?: NeProperties;
}

/**
 * Noms des villes du monde entier (Natural Earth 1:10m « populated places », domaine public, ≈ 7 300 lieux),
 * triés de la plus peuplée à la moins peuplée : le client les affiche dans cet ordre en évitant les chevauchements,
 * donc les grandes villes de loin et de plus en plus de villes en zoomant.
 * Chaque lieu porte aussi son nom dans l'écriture locale (`native`) quand Natural Earth le fournit, avec un
 * identifiant d'écriture (`script`) pour que le client choisisse la police et la taille adaptées.
 * Téléchargé une fois (jsDelivr) puis gardé en mémoire ; en cas d'échec, l'appel suivant réessaie.
 */
@Injectable()
export class CityLabelsService {
  private cache: Promise<CityLabelsDto> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  get(): Promise<CityLabelsDto> {
    if (!this.cache) this.cache = this.load().catch((e) => { this.cache = null; throw e; });
    return this.cache;
  }

  private async load(): Promise<CityLabelsDto> {
    const url = this.config.cityLabels.sourceUrl;
    let body: { features?: NeFeature[] };
    try {
      const res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = (await res.json()) as { features?: NeFeature[] };
    } catch (e) {
      throw new BadGatewayException(`Noms des villes indisponibles (${url}) : ${(e as Error).message}`);
    }
    const items = (body.features ?? [])
      .filter((f) => f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates))
      .map((f) => {
        const p = f.properties ?? {};
        const [lon, lat] = f.geometry!.coordinates!;
        const name = String(p.NAME || p.NAMEASCII || '');
        const iso = String(p.ISO_A2 || '').toUpperCase();
        const script = SCRIPT_BY_COUNTRY.get(iso);
        const local = script ? String(p[script.field] ?? '').trim() : '';
        const country = String(p.ADM0NAME || '');
        const countryFr = /^[A-Z]{2}$/.test(iso) ? COUNTRY_NAMES_FR.of(iso) : undefined;
        const nameFr = String(p.NAME_FR || '').trim();
        const region = String(p.ADM1NAME || '').trim();
        const timezone = String(p.TIMEZONE || '').trim();
        const areaKm2 = Math.max(0, Math.round(Number(p.MAX_AREAKM) || 0));
        return {
          name,
          ...(nameFr && nameFr !== name ? { nameFr } : {}),
          country,
          ...(countryFr && countryFr !== country ? { countryFr } : {}),
          ...(region && region !== name ? { region } : {}),
          ...(timezone ? { timezone } : {}),
          ...(areaKm2 ? { areaKm2 } : {}),
          lon: round(lon),
          lat: round(lat),
          pop: Math.max(0, Math.round(Number(p.POP_MAX) || 0)),
          capital: p.ADM0CAP === 1,
          ...(script && local && local !== name ? { native: local, script: script.script } : {}),
        };
      })
      .filter((c) => c.name && Number.isFinite(c.lon) && Number.isFinite(c.lat))
      // Capitales d'abord à population égale, puis par population décroissante.
      .sort((a, b) => b.pop - a.pop || Number(b.capital) - Number(a.capital));
    return { source: 'Natural Earth 1:10m populated places', attribution: 'Villes : Natural Earth', count: items.length, items };
  }
}
