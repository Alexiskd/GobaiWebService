// Type ProviderId : l'identifiant d'un fournisseur de tuiles, parmi :
export type ProviderId =
  // NASA GIBS (la Terre) ;
  | 'gibs'
  // NASA Moon Trek ;
  | 'nasa-trek'
  // NASA Mars Trek ;
  | 'mars-trek'
  // NASA Moon Trek en WMTS ;
  | 'moon-trek'
  // USGS Astrogeology en WMS (la Lune) ;
  | 'usgs-astro'
  // LROC Lunaserv (la Lune) ;
  | 'lroc-lunaserv'
  // USGS Astrogeology pour Mars ;
  | 'usgs-astro-mars'
  // OpenPlanetaryMap pour Mars ;
  | 'opm-mars'
  // Murray Lab (mosaïque CTX de Mars) ;
  | 'murray-lab'
  // Lunaserv pour Mercure ;
  | 'mercury-lunaserv'
  // USGS Astrogeology pour Mercure ;
  | 'usgs-astro-mercury'
  // Mercury Trek ;
  | 'mercury-trek'
  // Mercury Trek en WMTS ;
  | 'mercury-trek-wmts'
  // fond MESSENGER / USGS de Mercure ;
  | 'mercury-quickmap'
  // OpenPlanetaryMap pour Mercure ;
  | 'opm-mercury'
  // Trek pour les satellites naturels ;
  | 'satellite-trek'
  // la couche unique de la Terre ;
  | 'earth-hd'
  // le LiDAR HD de l'IGN.
  | 'ign-lidar-hd';

/** Astre sur lequel la couche se pose. */
// Type TileBody : l'astre d'une couche, parmi la Terre, la Lune, Mars, Mercure, Vénus,
export type TileBody = 'earth' | 'moon' | 'mars' | 'mercury' | 'venus'
  // les lunes de Jupiter,
  | 'io' | 'europa' | 'ganymede' | 'callisto'
  // celles de Saturne,
  | 'mimas' | 'enceladus' | 'tethys' | 'dione' | 'rhea' | 'titan' | 'iapetus'
  // celles d'Uranus, de Neptune et de Pluton,
  | 'miranda' | 'ariel' | 'umbriel' | 'titania' | 'oberon' | 'triton' | 'charon'
  // les géantes,
  | 'jupiter' | 'saturn' | 'uranus' | 'neptune'
  // ou n'importe quel autre texte ; « string & {} » garde les suggestions de l'éditeur pour les noms connus.
  | (string & {}); // satellites ajoutés dynamiquement (tests Horizons + Trek)

/**
 * Découpage des tuiles :
 *  - `mercator` : Web Mercator XYZ, 2^z × 2^z tuiles, latitudes coupées à ±85,05° ;
 *  - `equirectangular` : géographique (plate carrée), 2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud.
 */
// Type TileProjection : Web Mercator ou géographique.
export type TileProjection = 'mercator' | 'equirectangular';

/** `imagery` photo satellite · `map` plan routier · `relief` relief ombré · `hybrid` photo + routes et noms · `overlay` calque transparent. */
// Type LayerKind : la nature d'une couche, parmi cinq.
export type LayerKind = 'imagery' | 'map' | 'relief' | 'hybrid' | 'overlay';

/** Description d'une couche : ne contient aucun secret, publiable telle quelle. */
// Forme de la description publique d'une couche.
export interface TileLayerInfo {
  // id : son identifiant.
  id: string;
  // label : son nom affiché.
  label: string;
  // description : ce qu'elle montre.
  description: string;
  // kind : sa nature.
  kind: LayerKind;
  // provider : son fournisseur.
  provider: ProviderId;
  // body : son astre.
  body: TileBody;
  // projection : son découpage.
  projection: TileProjection;
  // minZoom : son niveau le plus large.
  minZoom: number;
  // maxZoom : son niveau le plus fin.
  maxZoom: number;
  // tileSize : le côté de ses tuiles, en pixels.
  tileSize: number;
  /** Format attendu ; la valeur de `resolve()` fait foi. */
  // format : JPEG ou PNG.
  format: 'jpeg' | 'png';
  /** Vrai si les tuiles ont de la transparence (à superposer à un fond). */
  // transparent : vrai si ses tuiles ont de la transparence.
  transparent: boolean;
  // requiresKey : vrai si elle exige une clé.
  requiresKey: boolean;
  /** Vrai si le fournisseur n'a pas pu être vérifié contre sa documentation. */
  // experimental : vrai si le fournisseur n'a pas été vérifié.
  experimental: boolean;
// Fin de TileLayerInfo.
}

// Forme d'une couche résolue : la description, plus ce qui suit.
export interface ResolvedTileLayer extends TileLayerInfo {
  /** Modèle d'URL contenant {z}, {x}, {y}. L'ordre de ces marqueurs dans l'URL varie selon le fournisseur. */
  // urlTemplate : le modèle d'adresse de ses tuiles.
  urlTemplate: string;
  /** Quand le modèle cesse de fonctionner (ISO 8601, UTC) ; `null` = n'expire pas. À redemander avant. */
  // expiresAt : la date d'expiration du modèle, ou null.
  expiresAt: string | null;
  // attribution : la mention à afficher.
  attribution: { text: string };
  /**
   * Couche unique de la Terre : sources dans l'ordre de priorité, avec les modèles d'adresse de celles que le
   * navigateur peut charger lui-même (voir earth-sources.ts, directPlan). Absent : tout passe par `urlTemplate`.
   */
  // direct : les sources que le navigateur peut interroger lui-même, avec leurs niveaux, leurs emprises et leurs modèles d'adresse.
  direct?: Array<{ id: string; minZoom: number; maxZoom: number; bboxes?: Array<[number, number, number, number]>; templates?: string[]; lowZoom?: number }>;
  /** Emprises [ouest, sud, est, nord] (degrés) hors desquelles un calque n'est pas demandé (LiDAR HD : la France). */
  // bounds : les emprises hors desquelles la couche n'est pas demandée.
  bounds?: Array<[number, number, number, number]>;
  /** Couche unique de la Terre : le navigateur accorde les couleurs des sources nationales sur la mosaïque mondiale. */
  // colorMatch : vrai si le navigateur doit accorder les couleurs.
  colorMatch?: boolean;
// Fin de ResolvedTileLayer.
}

// Forme d'une zone visible.
export interface Viewport {
  // zoom : le niveau de zoom.
  zoom: number;
  // north : le bord nord.
  north: number;
  // south : le bord sud.
  south: number;
  // east : le bord est.
  east: number;
  // west : le bord ouest.
  west: number;
// Fin de Viewport.
}

// Interface que tout fournisseur de tuiles doit respecter.
export interface TileProvider {
  // id : son identifiant, non modifiable.
  readonly id: ProviderId;
  /** Vrai si ce fournisseur est utilisable avec la configuration actuelle (ex. clé présente). */
  // isAvailable : est-il utilisable ?
  isAvailable(): boolean;
  // layers : ses couches.
  layers(): TileLayerInfo[];
  // resolve : le modèle d'adresse d'une couche.
  resolve(layerId: string): Promise<ResolvedTileLayer>;
  /** Mention de sources de données à afficher pour la zone visible. */
  // attribution : la mention de sources pour une zone.
  attribution(layerId: string, viewport: Viewport): Promise<string>;
// Fin de TileProvider.
}
