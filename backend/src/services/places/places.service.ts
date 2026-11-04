import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';
import type { PlacesDto } from '../../dto/places.dto';

const UBER_API = 'https://api.uber.com/maps/beta';
const UBER_TOKEN_API = 'https://auth.uber.com/oauth/v2/token';
const TIMEOUT_MS = 8000;

/** Recherche d'adresses et lieux avec Uber Maps ; les secrets OAuth restent côté serveur. */
@Injectable()
export class PlacesService {
  private uberToken: { value: string; expiresAt: number } | null = null;
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async find(q: string, limit = 8): Promise<PlacesDto> {
    if (!this.config.tiles.uber.clientId || !this.config.tiles.uber.clientSecret) {
      throw new ServiceUnavailableException('Recherche mondiale indisponible : définissez UBER_CLIENT_ID et UBER_CLIENT_SECRET.');
    }
    return this.findUber(q, limit);
  }

  /** Recherche Uber Maps : OAuth reste côté serveur et les identifiants ne sont jamais exposés au navigateur. */
  private async findUber(q: string, limit: number): Promise<PlacesDto> {
    const token = await this.getUberToken();
    const qs = new URLSearchParams({ query: q, locale: this.config.tiles.uber.locale, num_results: String(limit) });
    const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
    let res: Response;
    try { res = await this.fetchFn(`${UBER_API}/autocomplete?${qs}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) }); }
    catch { throw new BadGatewayException('Uber Maps injoignable.'); }
    if (!res.ok) throw new BadGatewayException(`Uber Maps a répondu ${res.status}.`);
    const body = await res.json() as { entities?: Array<{ id?: string; location?: { name?: string; address?: string } }> };
    const candidates = (body.entities ?? []).filter((e) => e.id && (e.location?.name || e.location?.address));
    const items = await Promise.all(candidates.map(async (entity) => {
      try {
      const detailQuery = new URLSearchParams({ id: entity.id!, locale: this.config.tiles.uber.locale });
      const detail = await this.fetchFn(`${UBER_API}/details?${detailQuery}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!detail.ok) return null;
      const json = await detail.json() as { entity?: { location?: { name?: string; address?: string; coordinate?: { latitude?: number; longitude?: number } } } };
      const location = json.entity?.location;
      const lat = Number(location?.coordinate?.latitude), lon = Number(location?.coordinate?.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const name = location?.name || entity.location?.name || location?.address || entity.location?.address || '';
      return { name, context: location?.address || entity.location?.address || '', lon, lat };
      } catch { return null; }
    }));
    return { provider: 'uber', items: items.filter((p): p is NonNullable<typeof p> => Boolean(p?.name)), attribution: '© Uber' };
  }

  private async getUberToken(): Promise<string> {
    if (this.uberToken && this.uberToken.expiresAt > Date.now() + 60_000) return this.uberToken.value;
    const { clientId, clientSecret } = this.config.tiles.uber;
    const body = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, grant_type: 'client_credentials', scope: 'maps-apis' });
    let res: Response;
    try { res = await this.fetchFn(UBER_TOKEN_API, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(TIMEOUT_MS) }); }
    catch { throw new BadGatewayException('Authentification Uber Maps injoignable.'); }
    if (!res.ok) throw new BadGatewayException(`Authentification Uber Maps a répondu ${res.status}.`);
    const token = await res.json() as { access_token?: string; expires_in?: number };
    if (!token.access_token) throw new BadGatewayException('Uber Maps n’a pas fourni de jeton OAuth.');
    this.uberToken = { value: token.access_token, expiresAt: Date.now() + Math.max(60, token.expires_in ?? 3600) * 1000 };
    return this.uberToken.value;
  }
}
