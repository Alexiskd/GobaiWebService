import { NotFoundException } from '@nestjs/common';
import type { ResolvedTileLayer, TileLayerInfo, TileProvider } from './tile-provider';

/**
 * NASA Venus Trek (Solar System Treks, JPL) — mosaïques radar Magellan, gratuites et sans clé.
 * Services WMTS vérifiés sur leurs fichiers de capacités (…/1.0.0/WMTSCapabilities.xml) :
 * jeu `default028mm`, projection géographique, 2^(z+1) × 2^z tuiles de 256 px, images PNG,
 * ordre {z}/{ligne}/{colonne} = {z}/{y}/{x}. Le serveur de la NASA autorise le navigateur (CORS *).
 */
interface TrekLayer extends TileLayerInfo {
  path: string;
  matrixSet: string;
}

const base = {
  provider: 'venus-trek' as const, body: 'venus' as const, projection: 'equirectangular' as const,
  minZoom: 0, tileSize: 256, format: 'png' as const, transparent: false, requiresKey: false, experimental: false,
};

const LAYERS: TrekLayer[] = [
  { ...base, id: 'venus-magellan-c3', label: 'Magellan — mosaïque radar (2 025 m)', kind: 'imagery', maxZoom: 5,
    description: 'Mosaïque radar mondiale Magellan (résolution ≈ 2 km/pixel), fond par défaut de Venus Trek.',
    path: 'Venus_Magellan_C3-MDIR_Global_Mosaic_2025m', matrixSet: 'default028mm' },
  { ...base, id: 'venus-magellan-color', label: 'Magellan — mosaïque radar colorisée (4 641 m)', kind: 'imagery', maxZoom: 4,
    description: 'Mosaïque radar Magellan colorisée (≈ 4,6 km/pixel), reliefs et plaines volcaniques teintés.',
    path: 'Venus_Magellan_C3-MDIR_Colorized_Global_Mosaic_4641m', matrixSet: 'default028mm' },
  { ...base, id: 'venus-magellan-left', label: 'Magellan — vue radar gauche (75 m)', kind: 'imagery', maxZoom: 10,
    description: 'Mosaïque radar haute résolution Magellan, visée gauche (≈ 75 m/pixel au zoom maximal).',
    path: 'Venus_Magellan_LeftLook_mosaic_global_75m', matrixSet: 'default028mm' },
  { ...base, id: 'venus-topography', label: 'Topographie Magellan (4 641 m)', kind: 'relief', maxZoom: 4,
    description: 'Modèle numérique d’altitude Magellan (≈ 4,6 km/pixel).',
    path: 'Venus_Magellan_Topography_Global_4641m_gapfilled_v02', matrixSet: 'default028mm' },
  { ...base, id: 'venus-hillshade', label: 'Relief ombré Magellan (4 641 m)', kind: 'relief', maxZoom: 4,
    description: 'Relief ombré calculé depuis l’altimétrie radar Magellan.',
    path: 'Venus_Magellan_Hillshade_Global_4641m_gapfilled_v02', matrixSet: 'default028mm' },
  { ...base, id: 'venus-slope', label: 'Pente Magellan (4 641 m)', kind: 'relief', maxZoom: 4,
    description: 'Carte des pentes issue du modèle d’altitude Magellan.',
    path: 'Venus_Magellan_Slope_Global_4641m_gapfilled_v02', matrixSet: 'default028mm' },
  { ...base, id: 'venus-fresnel', label: 'Réflectivité de Fresnel (couleur)', kind: 'imagery', maxZoom: 4,
    description: 'Réflectivité de Fresnel mesurée par Magellan, en couleurs : nature du sol volcanique.',
    path: 'Venus_Magellan_ClrFresnelReflectivity_Global_4641m', matrixSet: 'default028mm' },
  { ...base, id: 'venus-emissivity', label: 'Émissivité micro-ondes (couleur)', kind: 'imagery', maxZoom: 4,
    description: 'Émissivité micro-ondes mesurée par Magellan, sensible à la température et à la texture du sol.',
    path: 'Venus_Magellan_ClrMicrowaveEmissivity_Global_4641m', matrixSet: 'default028mm' },
  { ...base, id: 'venus-bouguer', label: 'Anomalies de Bouguer (couleur)', kind: 'imagery', maxZoom: 2,
    description: 'Anomalies de gravité de Bouguer (Magellan RSS), à 1 point par degré.',
    path: 'Clrbouggrd', matrixSet: 'default028mm' },
  { ...base, id: 'venus-geoid', label: 'Géoïde (couleur)', kind: 'imagery', maxZoom: 2,
    description: 'Undulation du géoïde vénusien (Magellan RSS), à 1 point par degré.',
    path: 'Clrgeoidgrd', matrixSet: 'default028mm' },
];

export interface VenusTrekConfig {
  baseUrl: string;
}

/** Découpage plate carrée : 2^(z+1) colonnes × 2^z lignes. */
export const venusCols = (z: number) => 2 ** (z + 1);
export const venusRows = (z: number) => 2 ** z;

export class NasaTrekVenusProvider implements TileProvider {
  readonly id = 'venus-trek' as const;

  constructor(private readonly config: VenusTrekConfig) {}

  isAvailable(): boolean {
    return true;
  }

  has(layerId: string): boolean {
    return LAYERS.some((l) => l.id === layerId);
  }

  layers(): TileLayerInfo[] {
    return LAYERS.map(({ path: _p, matrixSet: _m, ...info }) => info);
  }

  async resolve(layerId: string): Promise<ResolvedTileLayer> {
    const layer = LAYERS.find((l) => l.id === layerId);
    if (!layer) {
      throw new NotFoundException(`Couche vénusienne inconnue : « ${layerId} ». Couches : ${LAYERS.map((l) => l.id).join(', ')}.`);
    }
    const { path, matrixSet, ...info } = layer;
    return {
      ...info,
      urlTemplate: `${this.config.baseUrl}/${path}/1.0.0/default/${matrixSet}/{z}/{y}/{x}.png`,
      expiresAt: null,
      attribution: { text: 'NASA Venus Trek — Magellan SAR (NASA/JPL/USGS)' },
    };
  }

  async attribution(): Promise<string> {
    return 'Vénus : mosaïques radar et gravimétrie Magellan (NASA/JPL/USGS) via NASA Venus Trek';
  }
}
