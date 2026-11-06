import { BadGatewayException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { ResolvedTileLayer, TileLayerInfo, TileProvider, Viewport } from './tile-provider';

/**
 * Imagerie satellite Google via l'API officielle Map Tiles (2D) : https://developers.google.com/maps/documentation/tile/2d-tiles-overview
 *
 *  1. `POST /v1/createSession` → jeton de session (valable ~2 semaines) par type de carte ;
 *  2. `GET /v1/2dtiles/{z}/{x}/{y}?session=…&key=…` → image Web Mercator 256 px ;
 *  3. `GET /tile/v1/viewport?…&north&south&east&west` → mentions de copyright de la zone visible (obligatoires).
 *
 * La clé reste sur le serveur : le navigateur charge les tuiles via `/api/v1/tiles/google/{layer}/{z}/{x}/{y}`,
 * relayées sans être stockées (le cache du navigateur suit les en-têtes renvoyés par Google).
 * Il suffit de restreindre la clé à l'API « Map Tiles » et à l'adresse IP du serveur.
 */
export interface GoogleTilesConfig {
  apiKey?: string;
  language: string;
  region: string;
  maxZoom: number;
}

interface LayerDef extends TileLayerInfo {
  session: { mapType: 'satellite'; layerTypes?: string[] };
}

interface Session {
  token: string;
  /** Instant (ms) à partir duquel on recrée la session. */
  renewAt: number;
}

export interface GoogleTile {
  body: Buffer;
  contentType: string;
  cacheControl: string | null;
}

const API = 'https://tile.googleapis.com';
const TIMEOUT_MS = 10_000;
const ATTRIBUTION_CACHE = 200;

export class GoogleTileProvider implements TileProvider {
  readonly id = 'google' as const;
  private readonly defs: LayerDef[];
  private readonly sessions = new Map<string, Promise<Session>>();
  private readonly attributions = new Map<string, string>();

  constructor(
    private readonly config: GoogleTilesConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly now: () => number = Date.now,
  ) {
    const base = {
      provider: 'google' as const,
      body: 'earth' as const,
      projection: 'mercator' as const,
      minZoom: 0,
      maxZoom: config.maxZoom,
      tileSize: 256,
      format: 'jpeg' as const,
      transparent: false,
      requiresKey: true,
      experimental: false,
    };
    this.defs = [
      {
        ...base,
        id: 'google-satellite',
        label: 'Google — Satellite',
        description: 'Photos satellite et aériennes Google, haute résolution selon le zoom.',
        kind: 'imagery',
        session: { mapType: 'satellite' },
      },
      {
        ...base,
        id: 'google-hybrid',
        label: 'Google — Satellite + routes',
        description: 'Photos satellite Google avec routes et noms de lieux.',
        kind: 'hybrid',
        session: { mapType: 'satellite', layerTypes: ['layerRoadmap'] },
      },
    ];
  }

  isAvailable(): boolean {
    return Boolean(this.config.apiKey);
  }

  layers(): TileLayerInfo[] {
    if (!this.isAvailable()) return [];
    return this.defs.map(({ session: _s, ...info }) => info);
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    const { session: _s, ...info } = this.def(layerId);
    return {
      ...info,
      // Relayé par le backend (la clé ne quitte pas le serveur) ; le frontend rend ce chemin absolu.
      urlTemplate: `/api/v1/tiles/google/${info.id}/{z}/{x}/{y}`,
      expiresAt: null,
      attribution: { text: 'Google' },
    };
  }

  /** Télécharge une tuile chez Google ; recrée la session une fois si elle a expiré. */
  async tile(layerId: string, z: number, x: number, y: number): Promise<GoogleTile> {
    const def = this.def(layerId);
    if (z < def.minZoom || z > def.maxZoom) throw new NotFoundException(`Zoom ${z} hors limites (0 à ${def.maxZoom}).`);
    for (let attempt = 0; attempt < 2; attempt++) {
      const { token } = await this.session(def);
      const url = `${API}/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(token)}&key=${encodeURIComponent(this.config.apiKey!)}`;
      const res = await this.request(url);
      if (res.ok) {
        return {
          body: Buffer.from(await res.arrayBuffer()),
          contentType: res.headers.get('content-type') || 'image/jpeg',
          cacheControl: res.headers.get('cache-control'),
        };
      }
      if (res.status === 404) throw new NotFoundException(`Pas d'imagerie Google pour la tuile ${z}/${x}/${y}.`);
      if ((res.status === 400 || res.status === 401 || res.status === 403) && attempt === 0) {
        this.sessions.delete(def.id); // session périmée : on en redemande une
        continue;
      }
      throw new BadGatewayException(`Google Map Tiles a répondu ${res.status} : ${await errorText(res)}`);
    }
    throw new BadGatewayException('Google Map Tiles : session refusée.');
  }

  async attribution(layerId: string, viewport: Viewport): Promise<string> {
    const def = this.def(layerId);
    // Arrondi : évite une requête Google à chaque petit déplacement de la caméra.
    const r = (v: number) => Math.round(v * 100) / 100;
    const q = { zoom: Math.min(Math.round(viewport.zoom), def.maxZoom), north: r(viewport.north), south: r(viewport.south), east: r(viewport.east), west: r(viewport.west) };
    const cacheKey = `${def.id}|${q.zoom}|${q.north}|${q.south}|${q.east}|${q.west}`;
    const cached = this.attributions.get(cacheKey);
    if (cached !== undefined) return cached;
    try {
      const { token } = await this.session(def);
      const qs = new URLSearchParams({ session: token, key: this.config.apiKey!, ...Object.fromEntries(Object.entries(q).map(([k, v]) => [k, String(v)])) });
      const res = await this.request(`${API}/tile/v1/viewport?${qs}`);
      if (!res.ok) return 'Google';
      const data = (await res.json()) as { copyright?: string };
      const text = data.copyright ? `Google · ${data.copyright}` : 'Google';
      if (this.attributions.size >= ATTRIBUTION_CACHE) this.attributions.delete(this.attributions.keys().next().value!);
      this.attributions.set(cacheKey, text);
      return text;
    } catch {
      return 'Google';
    }
  }

  private def(layerId: string): LayerDef {
    if (!this.isAvailable()) throw new ServiceUnavailableException('Imagerie Google désactivée : GOOGLE_MAPS_API_KEY absente du .env du backend.');
    const def = this.defs.find((d) => d.id === layerId);
    if (!def) throw new NotFoundException(`Couche Google inconnue : « ${layerId} ».`);
    return def;
  }

  /** Session partagée par couche, recréée une heure avant son expiration. */
  private session(def: LayerDef): Promise<Session> {
    const current = this.sessions.get(def.id);
    if (current) {
      return current.then((s) => {
        if (s.renewAt > this.now()) return s;
        this.sessions.delete(def.id);
        return this.session(def);
      });
    }
    const created = this.createSession(def);
    this.sessions.set(def.id, created);
    created.catch(() => { if (this.sessions.get(def.id) === created) this.sessions.delete(def.id); });
    return created;
  }

  private async createSession(def: LayerDef): Promise<Session> {
    const res = await this.request(`${API}/v1/createSession?key=${encodeURIComponent(this.config.apiKey!)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...def.session, language: this.config.language, region: this.config.region }),
    });
    if (!res.ok) {
      throw new BadGatewayException(
        `Google Map Tiles : création de session refusée (${res.status}) — vérifie que l'API « Map Tiles » est activée et la facturation configurée. ${await errorText(res)}`,
      );
    }
    const data = (await res.json()) as { session: string; expiry?: string };
    const expiryMs = Number(data.expiry) * 1000;
    const renewAt = Number.isFinite(expiryMs) && expiryMs > 0 ? expiryMs - 3_600_000 : this.now() + 24 * 3_600_000;
    return { token: data.session, renewAt };
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Google Map Tiles injoignable : ${(e as Error).message}`);
    }
  }
}

async function errorText(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    return data.error?.message ?? '';
  } catch {
    return '';
  }
}
