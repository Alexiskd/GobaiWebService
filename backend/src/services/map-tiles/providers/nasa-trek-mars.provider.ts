import { NotFoundException } from '@nestjs/common';
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA Mars Trek (Solar System Treks, JPL) — mosaïque globale couleur de Mars (Viking MDIM21, 232 m/px),
 * gratuite et sans clé. Service WMTS vérifié : jeu de tuiles `default028mm`, projection géographique
 * (plate carrée), ordre WMTS {z}/{ligne}/{colonne} = {z}/{y}/{x}, images JPEG.
 * Le serveur de la NASA autorise les appels depuis le navigateur (CORS *) : les images sont chargées
 * directement, sans relais par le backend.
 */
interface TrekLayer extends TileLayerInfo {
  path: string;
  matrixSet: string;
  extension: 'jpg' | 'png';
}

const base = {
  provider: 'mars-trek' as const, body: 'mars' as const, projection: 'equirectangular' as const,
  minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
};

const LAYERS: TrekLayer[] = [
  {
    ...base, id: 'mars-viking', label: 'Mars (Viking MDIM21)', kind: 'imagery', maxZoom: 7,
    description: 'Mosaïque globale couleur Viking MDIM21 (232 m/pixel), diffusée par Mars Trek.',
    path: 'Mars_Viking_MDIM21_ClrMosaic_global_232m', matrixSet: 'default028mm', extension: 'jpg',
  },
];

export interface MarsTrekConfig {
  baseUrl: string;
}

/** Découpage plate carrée : 2^(z+1) colonnes × 2^z lignes. */
export const marsCols = (z: number) => 2 ** (z + 1);
export const marsRows = (z: number) => 2 ** z;

export class NasaTrekMarsProvider implements TileProvider {
  readonly id = 'mars-trek' as const;

  constructor(private readonly config: MarsTrekConfig) {}

  isAvailable(): boolean {
    return true;
  }

  has(layerId: string): boolean {
    return LAYERS.some((l) => l.id === layerId);
  }

  layers(): TileLayerInfo[] {
    return LAYERS.map(({ path: _p, matrixSet: _m, extension: _e, ...info }) => info);
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer) {
      throw new NotFoundException(`Couche martienne inconnue : « ${layerId} ». Couches : ${LAYERS.map((l) => l.id).join(', ')}.`);
    }
    const { path, matrixSet, extension, ...info } = layer;
    return {
      ...info,
      urlTemplate: `${this.config.baseUrl}/${path}/1.0.0/default/${matrixSet}/{z}/{y}/{x}.${extension}`,
      expiresAt: null,
      attribution: { text: 'NASA Mars Trek — mosaïque Viking MDIM21 (NASA/GSFC/USGS)' },
    };
  }

  async attribution(): Promise<string> {
    return 'Mars : mosaïque Viking MDIM21 (NASA/GSFC/USGS) via NASA Mars Trek';
  }
}
