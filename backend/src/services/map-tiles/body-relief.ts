/**
 * Relief des astres solides autres que la Terre et la Lune (Mars, Mercure) : fonctions pures, sans NestJS ni base
 * de données, pour être testées seules. Le service (body-relief.service.ts) s'occupe du réseau, du cache et de BP.
 *
 * Même méthode que le relief de la Lune (moon-relief.service.ts) : le modèle numérique d'élévation de l'astre est lu
 * sur un ImageServer ArcGIS de NASA Trek (exportImage, TIFF en flottants 32 bits), puis réencodé en tuiles Terrarium
 * dans le découpage géographique des images de l'astre : 2^(z+1) × 2^z tuiles au niveau z, de −180° à +180°.
 */
import type { HeightGrid } from './terrarium';

/** Un astre dont le relief est servi : sa source d'altitudes et ses bornes. */
export interface BodyReliefSource {
  /** Identifiant de l'astre dans l'adresse (« mars », « mercury »). */
  id: string;
  /** Nom français de l'astre, pour les messages. */
  label: string;
  /** Jeu de données, pour l'état et les crédits. */
  dataset: string;
  /** Adresse de l'ImageServer ArcGIS (sans « /exportImage »). */
  url: string;
  /** Variable d'environnement qui remplace cette adresse. */
  env: string;
  /** Rayon de la sphère de référence des altitudes, en km. */
  radiusKm: number;
  /** Niveau de tuile le plus fin servi : au-delà, le moteur agrandit la tuile de ce niveau. */
  maxZoom: number;
  /** Altitude absolue maximale plausible, en mètres : au-delà, le pixel est une absence de donnée. */
  limitM: number;
  /** Référence spatiale à préciser dans la demande (bboxSR et imageSR), si le service l'exige. */
  srs?: string;
}

/**
 * Les astres servis.
 *  - Mars : mélange MOLA (MGS) + HRSC (Mars Express) à 200 m/pixel, de NASA Mars Trek. À 200 m, une tuile de 256 px
 *    du niveau 8 (≈ 162 m par pixel à l'équateur) est déjà au-delà de la donnée : niveau 8 au plus.
 *    Extrêmes de Mars : Hellas vers −8 200 m, Olympus Mons vers +21 200 m.
 *  - Mercure : DEM global MESSENGER / USGS à 665 m/pixel (v2), de NASA Mercury Trek — le jeu déjà référencé par le
 *    catalogue de Mercure (couche « usgs-dem-665m »). À 665 m, le niveau 6 (≈ 468 m par pixel) suffit.
 *    Extrêmes de Mercure : environ −5 400 m à +4 500 m.
 */
export const BODY_RELIEF_SOURCES: Record<string, BodyReliefSource> = {
  mars: {
    id: 'mars', label: 'Mars', dataset: 'MGS MOLA + MEX HRSC, DEM mélangé 200 m (NASA Mars Trek)',
    url: 'https://trek.nasa.gov/mars/trekarcgis/rest/services/Mars_MOLA_blend200ppx_HRSC_DEM_clon0dd_200mpp_lzw/ImageServer',
    env: 'MARS_RELIEF_IMAGESERVER_URL', radiusKm: 3396.19, maxZoom: 8, limitM: 25_000,
  },
  mercury: {
    id: 'mercury', label: 'Mercure', dataset: 'MESSENGER MDIS, DEM global USGS 665 m v2 (NASA Mercury Trek)',
    url: 'https://trek.nasa.gov/mercury/arcgis/rest/services/mercury/Mercury_Messenger_USGS_DEM_Global_665m_v2/ImageServer',
    env: 'MERCURY_RELIEF_IMAGESERVER_URL', radiusKm: 2439.4, maxZoom: 6, limitM: 12_000, srs: '19900',
  },
};

/** Côté d'une tuile de relief, en pixels. */
export const BODY_RELIEF_TILE = 256;

/** La source d'un astre, ou undefined s'il n'a pas de relief servi. */
export const bodyReliefSource = (body: string): BodyReliefSource | undefined =>
  Object.prototype.hasOwnProperty.call(BODY_RELIEF_SOURCES, body) ? BODY_RELIEF_SOURCES[body] : undefined;

/** Emprise d'une tuile du découpage géographique : [ouest, sud, est, nord] en degrés, tuile 0/0/0 à l'ouest. */
export function bodyTileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const span = 180 / 2 ** z;
  const west = -180 + x * span, north = 90 - y * span;
  return [west, north - span, west + span, north];
}

/**
 * Pas vertical de l'encodage Terrarium selon le niveau : 1 m aux niveaux larges (fichiers légers), jusqu'à 0,25 m
 * aux niveaux fins. Même règle que la Lune.
 */
export const bodyVerticalStep = (z: number): number => Math.max(0.25, Math.min(1, 2 ** (4 - z)));

/** Adresse exportImage d'une tuile : TIFF non compressé en flottants 32 bits, interpolation bilinéaire. */
export function bodyReliefExportUrl(source: BodyReliefSource, base: string, z: number, x: number, y: number, size = BODY_RELIEF_TILE): string {
  const params = new URLSearchParams({
    bbox: bodyTileBounds(z, x, y).join(','),
    ...(source.srs ? { bboxSR: source.srs, imageSR: source.srs } : {}),
    size: `${size},${size}`,
    format: 'tiff',
    pixelType: 'F32',
    compression: 'None',
    interpolation: 'RSP_BilinearInterpolation',
    f: 'image',
  });
  return `${base.replace(/\/+$/, '')}/exportImage?${params.toString()}`;
}

/**
 * Nettoie une grille d'altitudes : tout pixel non fini ou au-delà de la borne plausible de l'astre (valeur
 * « absence de donnée » du service, souvent −32768 ou ±3,4e38) devient NaN, que l'encodeur Terrarium écrit comme
 * une absence de donnée. Les altitudes sont en mètres dans les deux jeux : aucune conversion d'unité.
 */
export function cleanBodyHeights(grid: HeightGrid, limitM: number): HeightGrid {
  const out = new Float32Array(grid.data.length);
  for (let i = 0; i < out.length; i++) {
    const m = grid.data[i];
    out[i] = Number.isFinite(m) && Math.abs(m) <= limitM ? m : Number.NaN;
  }
  return { width: grid.width, height: grid.height, data: out };
}

/** Part des pixels sans donnée d'une grille nettoyée, de 0 à 1. */
export function missingShare(grid: HeightGrid): number {
  let n = 0;
  for (let i = 0; i < grid.data.length; i++) if (Number.isNaN(grid.data[i])) n++;
  return grid.data.length ? n / grid.data.length : 1;
}
