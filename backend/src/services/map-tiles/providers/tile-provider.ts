export type ProviderId =
  | 'gibs'
  | 'google'
  | 'nasa-trek'
  | 'mars-trek'
  | 'venus-trek'
  | 'moon-trek'
  | 'usgs-astro'
  | 'lroc-lunaserv'
  | 'usgs-astro-mars'
  | 'opm-mars'
  | 'murray-lab'
  | 'mercury-lunaserv'
  | 'usgs-astro-mercury'
  | 'mercury-trek'
  | 'mercury-trek-wmts'
  | 'mercury-quickmap'
  | 'opm-mercury';

/** Astre sur lequel la couche se pose. */
export type TileBody = 'earth' | 'moon' | 'mars' | 'mercury' | 'venus';

/**
 * Découpage des tuiles :
 *  - `mercator` : Web Mercator XYZ, 2^z × 2^z tuiles, latitudes coupées à ±85,05° ;
 *  - `equirectangular` : géographique (plate carrée), 2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud.
 */
export type TileProjection = 'mercator' | 'equirectangular';

/** `imagery` photo satellite · `map` plan routier · `relief` relief ombré · `hybrid` photo + routes et noms · `overlay` calque transparent. */
export type LayerKind = 'imagery' | 'map' | 'relief' | 'hybrid' | 'overlay';

/** Description d'une couche : ne contient aucun secret, publiable telle quelle. */
export interface TileLayerInfo {
  id: string;
  label: string;
  description: string;
  kind: LayerKind;
  provider: ProviderId;
  body: TileBody;
  projection: TileProjection;
  minZoom: number;
  maxZoom: number;
  tileSize: number;
  /** Format attendu ; la valeur de `resolve()` fait foi. */
  format: 'jpeg' | 'png';
  /** Vrai si les tuiles ont de la transparence (à superposer à un fond). */
  transparent: boolean;
  requiresKey: boolean;
  /** Vrai si le fournisseur n'a pas pu être vérifié contre sa documentation. */
  experimental: boolean;
}

export interface ResolvedTileLayer extends TileLayerInfo {
  /** Modèle d'URL contenant {z}, {x}, {y}. L'ordre de ces marqueurs dans l'URL varie selon le fournisseur. */
  urlTemplate: string;
  /** Quand le modèle cesse de fonctionner (ISO 8601, UTC) ; `null` = n'expire pas. À redemander avant. */
  expiresAt: string | null;
  attribution: { text: string };
}

export interface Viewport {
  zoom: number;
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TileProvider {
  readonly id: ProviderId;
  /** Vrai si ce fournisseur est utilisable avec la configuration actuelle (ex. clé présente). */
  isAvailable(): boolean;
  layers(): TileLayerInfo[];
  resolve(layerId: string): Promise<ResolvedTileLayer>;
  /** Mention de sources de données à afficher pour la zone visible. */
  attribution(layerId: string, viewport: Viewport): Promise<string>;
}
