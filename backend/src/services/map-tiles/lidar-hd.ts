// Types (effacés à la compilation) d'une couche résolue et d'une description de couche.
import type { ResolvedTileLayer, TileLayerInfo } from './providers/tile-provider';
// Emprises de la France métropolitaine et de l'outre-mer, et type d'une emprise.
import { FRANCE, FRANCE_OUTRE_MER, type Bbox } from './earth-sources';
// Index des villes de France couvertes par le programme, et type d'une ville.
import { LIDAR_HD_CITIES, type LidarHdCity } from '../data/lidar-hd-cities.data';

/**
 * LiDAR HD de l'IGN (programme national, au moins 10 impulsions par m²) : calques de la Terre, sur la France.
 *
 * Le nuage de points classé lui-même est diffusé en dalles volumineuses, à télécharger : il ne se diffuse pas en
 * continu vers un navigateur de téléphone. Le site affiche donc les modèles que l'IGN en a tirés et qu'il sert déjà
 * découpés en tuiles (WMTS de la Géoplateforme, Web Mercator, PNG, niveaux 0 à 18, sans clé) : l'ombrage du modèle
 * de surface (sol, bâtiments, végétation), du modèle de terrain (sol nu) et du modèle de hauteur (sursol seul).
 * Les tuiles sont chargées directement par le navigateur, comme les orthophotos : rien ne passe par ce serveur.
 * Couverture : la France, là où le programme est diffusé ; ailleurs le calque est vide et le fond reste visible.
 */
// Forme d'un produit LiDAR HD.
export interface LidarHdProduct {
  // key : sa clé (surface, terrain ou hauteur).
  key: 'mns' | 'mnt' | 'mnh';
  // label : son nom affiché.
  label: string;
  // description : ce qu'il montre.
  description: string;
  /** Identifiant de la couche WMTS de la Géoplateforme. */
  // wmtsLayer : le nom de sa couche chez l'IGN.
  wmtsLayer: string;
// Fin de LidarHdProduct.
}

// Les trois produits proposés :
export const LIDAR_HD_PRODUCTS: LidarHdProduct[] = [
  // premier produit,
  {
    // le modèle de surface : sol, bâtiments et végétation ;
    key: 'mns', label: 'LiDAR HD · surface (sol, bâtiments, végétation)',
    // sa description ;
    description: 'Ombrage du modèle numérique de surface LiDAR HD de l’IGN : le sol et tout ce qu’il porte, bâtiments et arbres compris.',
    // sa couche chez l'IGN.
    wmtsLayer: 'IGNF_LIDAR-HD_MNS_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW',
  // Fin du premier produit.
  },
  // Deuxième produit,
  {
    // le modèle de terrain : le sol nu ;
    key: 'mnt', label: 'LiDAR HD · sol nu',
    // sa description ;
    description: 'Ombrage du modèle numérique de terrain LiDAR HD de l’IGN : le sol seul, sans bâtiments ni végétation.',
    // sa couche chez l'IGN.
    wmtsLayer: 'IGNF_LIDAR-HD_MNT_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW',
  // Fin du deuxième produit.
  },
  // Troisième produit,
  {
    // le modèle de hauteur : ce qui dépasse du sol ;
    key: 'mnh', label: 'LiDAR HD · hauteurs (bâtiments, végétation)',
    // sa description ;
    description: 'Ombrage du modèle numérique de hauteur LiDAR HD de l’IGN : la hauteur de ce qui dépasse du sol.',
    // sa couche chez l'IGN.
    wmtsLayer: 'IGNF_LIDAR-HD_MNH_ELEVATION.ELEVATIONGRIDCOVERAGE.SHADOW',
  // Fin du troisième produit.
  },
// Fin de la liste.
];

// Préfixe des identifiants de ces calques.
export const LIDAR_HD_PREFIX = 'lidar-hd-';
// Mention à afficher.
export const LIDAR_HD_ATTRIBUTION = 'LiDAR HD © IGN — Géoplateforme (Licence Ouverte 2.0)';
/** En dessous du niveau 6 la France tient dans quelques pixels : le calque n'est pas demandé. */
// Niveau de zoom minimal du calque.
export const LIDAR_HD_MIN_ZOOM = 6;
// Niveau de zoom maximal du calque.
export const LIDAR_HD_MAX_ZOOM = 18;
/**
 * Emprises où le calque est demandé : la France métropolitaine, la Corse et les cinq départements et régions
 * d'outre-mer, tous couverts par le programme. Ailleurs sur le globe, aucune tuile n'est demandée (voir
 * `TileSource.covers` côté navigateur) : le fond de carte reste visible tel quel.
 */
// Emprises où le calque est demandé : la métropole, puis l'outre-mer.
export const LIDAR_HD_BOUNDS: Bbox[] = [FRANCE, ...FRANCE_OUTRE_MER];

// Adresse du service WMTS de l'IGN : GEOPF_WMTS_URL si elle est définie, sinon l'adresse officielle ; les « ? » et « & » de fin sont retirés.
const WMTS_BASE = (process.env.GEOPF_WMTS_URL?.trim() || 'https://data.geopf.fr/wmts').replace(/[?&]+$/, '');

// Fonction lidarHdLayerId : l'identifiant d'un calque, le préfixe suivi de la clé.
export const lidarHdLayerId = (key: LidarHdProduct['key']): string => `${LIDAR_HD_PREFIX}${key}`;

/** Modèle d'adresse d'une tuile WMTS de la Géoplateforme (jeu de tuiles PM_0_18 : Web Mercator, niveaux 0 à 18). */
// Fonction lidarHdTemplate : le modèle d'adresse des tuiles d'une couche.
export function lidarHdTemplate(wmtsLayer: string, base: string = WMTS_BASE): string {
  // Début de la requête WMTS : service, type de requête, version, couche, style ;
  return `${base}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${wmtsLayer}&STYLE=normal`
    // fin : jeu de tuiles, format PNG, et les trous {z}, {y}, {x}.
    + '&TILEMATRIXSET=PM_0_18&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
// Fin de lidarHdTemplate.
}

// Fonction info : la description publique d'un produit.
const info = (product: LidarHdProduct): TileLayerInfo => ({
  // Son identifiant.
  id: lidarHdLayerId(product.key),
  // Son nom affiché.
  label: product.label,
  // Sa description.
  description: product.description,
  // Nature : calque à superposer.
  kind: 'overlay',
  // Fournisseur : le LiDAR HD de l'IGN.
  provider: 'ign-lidar-hd',
  // Astre : la Terre.
  body: 'earth',
  // Projection : Web Mercator.
  projection: 'mercator',
  // Zoom minimal.
  minZoom: LIDAR_HD_MIN_ZOOM,
  // Zoom maximal.
  maxZoom: LIDAR_HD_MAX_ZOOM,
  // Tuiles de 256 pixels.
  tileSize: 256,
  // Format PNG.
  format: 'png',
  // Transparent.
  transparent: true,
  // Sans clé.
  requiresKey: false,
  // Vérifié.
  experimental: false,
// Fin de info.
});

/**
 * Altitude d'arrivée au-dessus d'une ville (m) : un quartier entier tient dans l'écran, au niveau de zoom où
 * l'ombrage LiDAR HD se lit (bâtiments et arbres un par un).
 */
// Altitude d'arrivée au-dessus d'une ville : 2 000 mètres.
export const LIDAR_HD_CITY_ALTITUDE_M = 2000;

/** Villes de France où le calque est proposé (GET /tiles/lidar-hd/cities), dans l'ordre d'importance. */
// Fonction lidarHdCities : l'index des villes.
export function lidarHdCities(): LidarHdCity[] {
  // L'index tel quel : les villes sont des données fixes, nul besoin d'en faire une copie à chaque appel.
  return LIDAR_HD_CITIES;
// Fin de lidarHdCities.
}

/** Calques LiDAR HD proposés (GET /tiles/layers). */
// Fonction lidarHdLayers : les calques proposés.
export function lidarHdLayers(): TileLayerInfo[] {
  // La description de chaque produit.
  return LIDAR_HD_PRODUCTS.map(info);
// Fin de lidarHdLayers.
}

/** Calque LiDAR HD prêt à charger (GET /tiles/layers/:id), ou null si l'identifiant n'en est pas un. */
// Fonction resolveLidarHd : un calque prêt à charger, ou null.
export function resolveLidarHd(layerId: string): ResolvedTileLayer | null {
  // Cherche le produit dont l'identifiant est celui demandé.
  const product = LIDAR_HD_PRODUCTS.find((p) => lidarHdLayerId(p.key) === layerId);
  // Aucun : null.
  if (!product) return null;
  // Renvoie :
  return {
    // sa description ;
    ...info(product),
    // son modèle d'adresse ;
    urlTemplate: lidarHdTemplate(product.wmtsLayer),
    // pas d'expiration ;
    expiresAt: null,
    // sa mention ;
    attribution: { text: LIDAR_HD_ATTRIBUTION },
    // ses emprises.
    bounds: LIDAR_HD_BOUNDS,
  // Fin de l'objet.
  };
// Fin de resolveLidarHd.
}
