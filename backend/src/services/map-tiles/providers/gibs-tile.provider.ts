import { NotFoundException } from '@nestjs/common';
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA GIBS (Global Imagery Browse Services) — fond de secours gratuit, sans clé.
 *
 * ⚠ EXPÉRIMENTAL : les noms de couches, le jeu de tuiles (GoogleMapsCompatible_LevelN) et les extensions ci-dessous
 * proviennent de la connaissance du service, pas d'une page de documentation relue ici. Si une couche ne s'affiche pas,
 * vérifiez-la sur https://nasa-gibs.github.io/gibs-api-docs/ et ajustez GIBS_BASE_URL ou ce fichier.
 * Les tuiles WMTS ont l'ordre {z}/{y}/{x} (ligne avant colonne) ; le modèle renvoyé en tient compte.
 */
interface GibsLayer extends TileLayerInfo {
  path: string;
  /** Jeu de tuiles, ex. GoogleMapsCompatible_Level8. */
  matrixSet: string;
  extension: 'jpeg' | 'jpg';
  /** Couche datée : on demande la veille (UTC), toujours disponible. */
  dated: boolean;
}

const base = { provider: 'gibs' as const, body: 'earth' as const, projection: 'mercator' as const, minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: true };

const LAYERS: GibsLayer[] = [
  { ...base, id: 'satellite', label: 'Satellite (Blue Marble)', kind: 'imagery', maxZoom: 8,
    description: 'Image composite NASA Blue Marble avec relief et bathymétrie. Résolution limitée (zoom 8).',
    path: 'BlueMarble_ShadedRelief_Bathymetry', matrixSet: 'GoogleMapsCompatible_Level8', extension: 'jpeg', dated: false },
  { ...base, id: 'daily', label: 'Image du jour (VIIRS)', kind: 'imagery', maxZoom: 9,
    description: 'Couleurs réelles de la veille, satellite Suomi NPP. Résolution limitée (zoom 9).',
    path: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', matrixSet: 'GoogleMapsCompatible_Level9', extension: 'jpg', dated: true },
];

export interface GibsConfig {
  baseUrl: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export class GibsTileProvider implements TileProvider {
  readonly id = 'gibs' as const;

  constructor(
    private readonly config: GibsConfig,
    private readonly now: () => number = Date.now,
  ) {}

  isAvailable(): boolean {
    return true;
  }

  layers(): TileLayerInfo[] {
    return LAYERS.map(({ path: _p, matrixSet: _m, extension: _e, dated: _d, ...info }) => info);
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer) {
      throw new NotFoundException(`Couche inconnue : « ${layerId} ». Couches NASA GIBS : ${LAYERS.map((l) => l.id).join(', ')}.`);
    }
    const { path, matrixSet, extension, dated, ...info } = layer;
    const today = Math.floor(this.now() / DAY_MS) * DAY_MS; // minuit UTC
    const date = new Date(today - DAY_MS).toISOString().slice(0, 10);
    const time = dated ? `/${date}` : '';
    return {
      ...info,
      urlTemplate: `${this.config.baseUrl}/${path}/default${time}/${matrixSet}/{z}/{y}/{x}.${extension}`,
      expiresAt: dated ? new Date(today + DAY_MS).toISOString() : null,
      attribution: { text: 'NASA EOSDIS GIBS' },
    };
  }

  async attribution(): Promise<string> {
    return 'Imagerie : NASA EOSDIS Global Imagery Browse Services (GIBS)';
  }
}
