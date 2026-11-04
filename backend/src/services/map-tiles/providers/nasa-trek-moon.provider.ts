import { NotFoundException } from '@nestjs/common';
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA Moon Trek (Solar System Treks, JPL) — relief de la Lune (altimètre laser LOLA de LRO), gratuit, sans clé.
 * Les couleurs naturelles viennent d'une texture à part (NASA SVS CGI Moon Kit, GET /api/v1/tiles/moon-color.jpg) :
 * Le client fusionne dans le shader des tuiles : détail (Kaguya TC), relief (ombrage LOLA) et couleurs naturelles.
 *
 * Services WMTS vérifiés sur leurs fichiers de capacités (…/1.0.0/WMTSCapabilities.xml) :
 *  - jeu de tuiles `default028mm`, projection géographique (plate carrée), coin haut-gauche (-180°, 90°) ;
 *  - niveau z : 2^(z+1) colonnes × 2^z lignes de 256 px ;
 *  - ordre WMTS {z}/{ligne}/{colonne}, soit {z}/{y}/{x}.
 * Relief : couche LOLA « Shade » 256 px/° (niveaux 0 à 6).
 * Les images passent par le cache disque du serveur (MoonTileCacheService, GET /api/v1/tiles/moon/{couche}/{z}/{x}/{y}) :
 * chaque tuile n'est téléchargée qu'une fois chez la NASA, puis servie depuis le disque.
 */
interface TrekLayer extends TileLayerInfo {
  format: 'jpeg' | 'png';
  path: string;
  matrixSet: string;
  extension: 'jpg' | 'png';
}

const base = {
  provider: 'nasa-trek' as const, body: 'moon' as const, projection: 'equirectangular' as const,
  minZoom: 0, tileSize: 256, format: 'jpeg' as const, transparent: false, requiresKey: false, experimental: false,
};

const LAYERS: TrekLayer[] = [
  // Détail : mosaïque mondiale de la caméra TC de Kaguya/SELENE (JAXA), en niveaux de gris. Capacités WMTS vérifiées :
  // default028mm, PNG, niveaux 0 à 10 (≈ 20 m/pixel au niveau 10). Le client en tire la luminosité fine et garde la
  // couleur de la texture naturelle (principe du « pan-sharpening »).
  { ...base, id: 'moon-kaguya', label: 'Détail Kaguya (TC)', kind: 'imagery', maxZoom: 10, format: 'png',
    description: 'Mosaïque mondiale de la caméra TC de Kaguya (JAXA), ≈ 20 m/pixel au zoom maximal.',
    path: 'Kaguya_TCortho_Mosaic_Global_4096ppd', matrixSet: 'default028mm', extension: 'png' },
  // Relief réel mesuré par l'altimètre laser LOLA de LRO (capacités WMTS vérifiées : default028mm, PNG, 2 × 1 tuiles au niveau 0).
  { ...base, id: 'moon-lola-shade', label: 'Relief réel (LOLA)', kind: 'relief', maxZoom: 6, format: 'png',
    description: 'Relief réel mesuré par l’altimètre laser LOLA (≈ 120 m/pixel).',
    path: 'LRO_LOLA_Shade_Global_256ppd_v06', matrixSet: 'default028mm', extension: 'png' },
];

export interface MoonTrekConfig {
  baseUrl: string;
}

/** Couches lunaires et leur niveau natif maximal (pour le préchargement). */
export const MOON_LAYER_LEVELS: ReadonlyArray<{ id: string; maxZoom: number }> = LAYERS.map((l) => ({ id: l.id, maxZoom: l.maxZoom }));

/** Découpage plate carrée : 2^(z+1) colonnes × 2^z lignes. */
export const moonCols = (z: number) => 2 ** (z + 1);
export const moonRows = (z: number) => 2 ** z;

export class NasaTrekMoonProvider implements TileProvider {
  readonly id = 'nasa-trek' as const;

  constructor(private readonly config: MoonTrekConfig) {}

  isAvailable(): boolean {
    return true;
  }

  has(layerId: string): boolean {
    return LAYERS.some((l) => l.id === layerId);
  }

  layers(): TileLayerInfo[] {
    return LAYERS.map(({ path: _p, matrixSet: _m, extension: _e, ...info }) => info);
  }

  /** Adresse de la tuile chez la NASA (utilisée par le cache disque), ou null si la tuile n'existe pas. */
  upstreamUrl(layerId: string, z: number, x: number, y: number): string | null {
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer || z < 0 || z > layer.maxZoom || x < 0 || y < 0 || x >= moonCols(z) || y >= moonRows(z)) return null;
    return `${this.config.baseUrl}/${layer.path}/1.0.0/default/${layer.matrixSet}/${z}/${y}/${x}.${layer.extension}`;
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer) {
      throw new NotFoundException(`Couche lunaire inconnue : « ${layerId} ». Couches : ${LAYERS.map((l) => l.id).join(', ')}.`);
    }
    const { path: _p, matrixSet: _m, extension: _e, ...info } = layer;
    return {
      ...info,
      // Relais avec cache disque : la tuile est servie localement dès le deuxième accès (ou après préchargement).
      urlTemplate: `/api/v1/tiles/moon/${layer.id}/{z}/{x}/{y}`,
      expiresAt: null,
      attribution: { text: layerId === 'moon-kaguya' ? 'NASA Moon Trek · Kaguya TC (JAXA/SELENE)' : 'NASA Moon Trek · LRO/LOLA (NASA/GSFC)' },
    };
  }

  async attribution(): Promise<string> {
    return 'Lune : détail JAXA/SELENE (Kaguya TC), relief NASA/GSFC (LRO LOLA) via NASA Solar System Treks, couleurs NASA Scientific Visualization Studio';
  }
}
