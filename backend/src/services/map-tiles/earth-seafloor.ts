/**
 * Fonds marins de la Terre : deux fonds de carte du relief des océans et des terres, proposés à côté de la couche
 * unique « earth-hd » (menu Terre, fond de carte). Ce sont les données que le globe Google Earth attribue à
 * « SIO, NOAA, U.S. Navy, NGA, GEBCO » et « IBCAO » :
 *  - earth-gebco : grille mondiale GEBCO_2026 en relief ombré (service WMS de GEBCO), qui réunit la bathymétrie
 *    mondiale, SRTM15+ (SIO, NOAA, U.S. Navy, NGA) et les grilles régionales comme l'IBCAO (Arctique) ;
 *  - earth-ncei : mosaïque mondiale des modèles d'élévation de la NOAA (NCEI), terre et mer sans couture, en relief
 *    ombré coloré par l'altitude et la profondeur (service d'images ArcGIS, fonction « ColorHillshade »).
 * Deux services sans clé, sans tuiles toutes faites : chaque tuile est une image demandée sur son emprise Web
 * Mercator, et le serveur la relaie comme les orthophotos WMS de la couche unique (voir earth-imagery.service.ts).
 * Fonctions pures, testées dans earth-seafloor.spec.ts.
 */

// Ouvre l'import du module des sources de la Terre : l'emprise Web Mercator d'une tuile, l'adresse WMS d'une tuile, le test d'un interrupteur coupé et le type d'une source.
import { isOff, mercatorBbox, wms, type EarthSource } from './earth-sources';
// Image de la chlorophylle : son emprise et les bornes de son échelle.
import { CHL_BOUNDS, CHL_MAX, CHL_MIN } from './earth-chlorophyll';

// Adresse du service WMS de GEBCO : GEBCO_WMS_URL si elle est définie, sinon l'adresse officielle ; les « ? » et « & » de fin sont retirés.
const GEBCO_BASE = (process.env.GEBCO_WMS_URL?.trim() || 'https://wms.gebco.net/mapserv').replace(/[?&]+$/, '');
// Couche WMS de GEBCO : la dernière grille en relief ombré (GEBCO_2026 depuis août 2026).
export const GEBCO_LAYER = 'GEBCO_LATEST';
// Adresse du service d'images de la NOAA : NCEI_DEM_URL si elle est définie, sinon l'adresse officielle ; la barre finale est retirée.
const NCEI_BASE = (process.env.NCEI_DEM_URL?.trim() || 'https://gis.ngdc.noaa.gov/arcgis/rest/services/DEM_mosaics/DEM_global_mosaic/ImageServer').replace(/\/$/, '');
// Fonction de rendu de la NOAA : relief ombré multidirectionnel, coloré par l'altitude et la profondeur.
export const NCEI_RENDERING = 'ColorHillshade';

/** Adresse d'une tuile de 256 px de la mosaïque de la NOAA : image exportée sur l'emprise Web Mercator de la tuile. */
// Fonction nceiTileUrl : l'adresse d'une tuile ; la base par défaut est celle de la NOAA.
export function nceiTileUrl(z: number, x: number, y: number, base: string = NCEI_BASE): string {
  // Export d'image sur l'emprise de la tuile, demandée et rendue en Web Mercator (3857) ;
  return `${base}/exportImage?bbox=${mercatorBbox(z, x, y)}&bboxSR=3857&imageSR=3857`
    // 256 × 256 pixels, en JPEG, avec la fonction de rendu en couleurs, renvoyée comme image.
    + `&size=256,256&format=jpg&renderingRule=${encodeURIComponent(JSON.stringify({ rasterFunction: NCEI_RENDERING }))}&f=image`;
// Fin de nceiTileUrl.
}

// Forme d'un fond marin : identifiant de la couche, nom, description, et sa source unique.
export interface SeafloorLayer { id: string; label: string; description: string; source: EarthSource }

// Les deux fonds marins, dans l'ordre du menu :
export const SEAFLOOR_LAYERS: SeafloorLayer[] = [
  // GEBCO,
  {
    // identifiant et nom ;
    id: 'earth-gebco', label: 'Fonds marins · GEBCO 2026 (relief ombré)',
    // sa description ;
    description: 'Profondeur des océans et relief des terres en relief ombré : grille mondiale GEBCO_2026 (≈ 450 m), avec SRTM15+ (SIO, NOAA, U.S. Navy, NGA) et l’IBCAO pour l’Arctique. Zoom jusqu’au niveau 10.',
    // sa source :
    source: {
      // identifiant, nom, monde entier, niveaux 0 à 10 (au-delà, la grille de ≈ 450 m n'a plus de détail) ;
      id: 'gebco', label: 'GEBCO 2026', minZoom: 0, maxZoom: 10,
      // sa mention ;
      attribution: 'Bathymétrie : GEBCO Compilation Group (2026) GEBCO_2026 Grid — IHO-IOC GEBCO (domaine public)',
      // une requête WMS 1.3.0 par tuile, sur la dernière grille.
      urls: (z, x, y) => [wms(GEBCO_BASE, GEBCO_LAYER, z, x, y)],
    // Fin de sa source.
    },
  // Fin de GEBCO.
  },
  // NOAA NCEI,
  {
    // identifiant et nom ;
    id: 'earth-ncei', label: 'Fonds marins · NOAA NCEI (relief en couleurs)',
    // sa description ;
    description: 'Mosaïque mondiale des modèles d’élévation de la NOAA, terre et mer sans couture, en relief ombré coloré par l’altitude et la profondeur ; plus fine le long des côtes des États-Unis. Zoom jusqu’au niveau 12.',
    // sa source :
    source: {
      // identifiant, nom, monde entier, niveaux 0 à 12 ;
      id: 'ncei', label: 'NOAA NCEI', minZoom: 0, maxZoom: 12,
      // sa mention ;
      attribution: 'Relief : NOAA National Centers for Environmental Information (NCEI), mosaïque mondiale des MNT (domaine public)',
      // une image exportée par tuile.
      urls: (z, x, y) => [nceiTileUrl(z, x, y)],
    // Fin de sa source.
    },
  // Fin de la NOAA.
  },
// Fin de la liste.
];

// Table qui donne un fond marin à partir de l'identifiant de sa couche.
export const SEAFLOOR_BY_ID = new Map(SEAFLOOR_LAYERS.map((l) => [l.id, l]));

/**
 * Fusion des fonds marins dans la couche unique « earth-hd », faite par le navigateur : là où les altitudes Terrarium
 * (AWS Terrain Tiles, déjà lues par le relief) sont sous la mer, la tuile GEBCO remplace peu à peu l'imagerie
 * satellite — l'eau peu profonde des côtes garde l'image satellite, le large montre le relief des fonds, comme sur
 * Google Earth. Les deux sont prises au niveau 10 au plus : une tuile sert toutes les tuiles affichées qu'elle couvre.
 * `EARTH_SEAFLOOR=0` coupe la fusion. Avec la chlorophylle (`EARTH_OCEAN_COLOUR=0` la coupe), l'eau du large prend
 * sa couleur réelle, calculée avec ocpy (voir frontend/scripts/couleur-ocean.py), ombrée par le relief des fonds.
 */
// Altitudes Terrarium d'AWS : TERRARIUM_URL si elle est définie, sinon l'adresse publique.
const TERRARIUM = process.env.TERRARIUM_URL?.trim() || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// Niveau maximal des tuiles des fonds et des altitudes lues pour la fusion : 10 (≈ 150 m par pixel à l'équateur).
export const SEAFLOOR_FUSION_MAX_ZOOM = 10;

// Fonction seafloorFusion : le réglage de la fusion pour le navigateur, ou null si elle est coupée ; par défaut, l'environnement du processus.
export function seafloorFusion(env: Record<string, string | undefined> = process.env): { template: string; maxZoom: number; mask: { template: string; maxZoom: number }; chlorophyll?: { url: string; bounds: [number, number, number, number]; min: number; max: number } } | null {
  // EARTH_SEAFLOOR coupé : null.
  if (isOff(env.EARTH_SEAFLOOR)) return null;
  // Renvoie :
  return {
    // les tuiles GEBCO, par le relais de ce serveur, jusqu'au niveau 10 ;
    template: '/api/v1/tiles/earth/earth-gebco/{z}/{x}/{y}', maxZoom: SEAFLOOR_FUSION_MAX_ZOOM,
    // les altitudes Terrarium, jusqu'au niveau 10 ;
    mask: { template: TERRARIUM, maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
    // l'image de la chlorophylle, sauf si EARTH_OCEAN_COLOUR est coupé.
    ...(isOff(env.EARTH_OCEAN_COLOUR) ? {} : { chlorophyll: { url: '/api/v1/tiles/earth-chlorophyll.png', bounds: CHL_BOUNDS, min: CHL_MIN, max: CHL_MAX } }),
  // Fin de l'objet.
  };
// Fin de seafloorFusion.
}
