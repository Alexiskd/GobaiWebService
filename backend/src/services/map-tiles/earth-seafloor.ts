/**
 * Fonds marins de la Terre : trois relais de tuiles du relief des océans et des terres, qui ne sont plus des fonds de
 * carte à part (la Terre n'a qu'une couche, « earth-hd »). Ce sont les données que le globe Google Earth attribue à
 * « SIO, NOAA, U.S. Navy, NGA, GEBCO » et « IBCAO » :
 *  - earth-gebco : grille mondiale GEBCO_2026 en relief ombré (service WMS de GEBCO), qui réunit la bathymétrie
 *    mondiale, SRTM15+ (SIO, NOAA, U.S. Navy, NGA) et les grilles régionales comme l'IBCAO (Arctique) ; le
 *    navigateur la fond au large dans la couche unique (voir seafloorFusion plus bas) ;
 *  - earth-ncei : mosaïque mondiale des modèles d'élévation de la NOAA (NCEI, ETOPO 2022), terre et mer sans couture,
 *    en relief ombré coloré par l'altitude et la profondeur (service d'images ArcGIS, fonction « ColorHillshade ») ;
 *    teinte des océans vue de l'espace de la carte marine ;
 *  - earth-gebco-flat : la même grille GEBCO_2026 en carte plate colorée selon l'altitude (couche WMS GEBCO_LATEST_2),
 *    en PNG : ses limites de couleur donnent les isobathes de la carte marine, sans autre source.
 * La carte marine (earthMarine plus bas) est décrite dans la table de la couche unique (earth-plan.ts) : GEBCO
 * vue de l'espace, fondu vers NOAA aux zooms moyens, NOAA seule aux zooms forts.
 * Deux services sans clé, sans tuiles toutes faites : chaque tuile est une image demandée sur son emprise Web
 * Mercator, et le serveur la relaie comme les orthophotos WMS de la couche unique (voir earth-imagery.service.ts).
 * Fonctions pures, testées dans earth-seafloor.spec.ts.
 */

// Ouvre l'import du module des sources de la Terre : l'emprise Web Mercator d'une tuile, l'adresse WMS d'une tuile, le test d'un interrupteur coupé et le type d'une source.
import { isOff, mercatorBbox, wms, type EarthSource } from './earth-sources';

// Adresse du service WMS de GEBCO : GEBCO_WMS_URL si elle est définie, sinon l'adresse officielle ; les « ? » et « & » de fin sont retirés.
const GEBCO_BASE = (process.env.GEBCO_WMS_URL?.trim() || 'https://wms.gebco.net/mapserv').replace(/[?&]+$/, '');
// Couche WMS de GEBCO : la dernière grille en relief ombré (GEBCO_2026 depuis août 2026).
export const GEBCO_LAYER = 'GEBCO_LATEST';
// Couche WMS de GEBCO en carte plate colorée selon l'altitude (même grille), source des isobathes.
export const GEBCO_FLAT_LAYER = 'GEBCO_LATEST_2';
// Mention de GEBCO, commune au relief ombré et à la carte plate.
const GEBCO_CREDIT = 'Bathymétrie : GEBCO Compilation Group (2026) GEBCO_2026 Grid — IHO-IOC GEBCO (domaine public, pas pour la navigation)';
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

// Forme d'un fond marin : identifiant de son relais (tuiles /api/v1/tiles/earth/<id>/…) et sa source unique.
export interface SeafloorLayer { id: string; source: EarthSource }

// Les deux fonds marins relayés :
export const SEAFLOOR_LAYERS: SeafloorLayer[] = [
  // GEBCO,
  {
    // identifiant du relais ;
    id: 'earth-gebco',
    // sa source :
    source: {
      // identifiant, nom, monde entier, niveaux 0 à 10 (au-delà, la grille de ≈ 450 m n'a plus de détail) ;
      id: 'gebco', label: 'GEBCO 2026', minZoom: 0, maxZoom: 10,
      // sa mention ;
      attribution: GEBCO_CREDIT,
      // une requête WMS 1.3.0 par tuile, sur la dernière grille.
      urls: (z, x, y) => [wms(GEBCO_BASE, GEBCO_LAYER, z, x, y)],
    // Fin de sa source.
    },
  // Fin de GEBCO.
  },
  // GEBCO en carte plate colorée (isobathes),
  {
    // identifiant du relais ;
    id: 'earth-gebco-flat',
    // sa source :
    source: {
      // identifiant, nom, monde entier, niveaux 0 à 10 ;
      id: 'gebco-flat', label: 'GEBCO 2026 (carte plate)', minZoom: 0, maxZoom: 10,
      // sa mention ;
      attribution: GEBCO_CREDIT,
      // une requête WMS 1.3.0 par tuile, en PNG : les couleurs restent nettes, sans les bavures du JPEG.
      urls: (z, x, y) => [wms(GEBCO_BASE, GEBCO_FLAT_LAYER, z, x, y, '1.3.0', 'image/png')],
    // Fin de sa source.
    },
  // Fin de la carte plate.
  },
  // NOAA NCEI,
  {
    // identifiant du relais ;
    id: 'earth-ncei',
    // sa source :
    source: {
      // identifiant, nom, monde entier, niveaux 0 à 12 ;
      id: 'ncei', label: 'NOAA NCEI', minZoom: 0, maxZoom: 12,
      // sa mention ;
      attribution: 'Relief : NOAA National Centers for Environmental Information (NCEI), ETOPO 2022 et mosaïque mondiale des MNT (CC0, domaine public)',
      // une image exportée par tuile.
      urls: (z, x, y) => [nceiTileUrl(z, x, y)],
    // Fin de sa source.
    },
  // Fin de la NOAA.
  },
// Fin de la liste.
];

// Table qui donne un fond marin à partir de l'identifiant de son relais.
export const SEAFLOOR_BY_ID = new Map(SEAFLOOR_LAYERS.map((l) => [l.id, l]));

/**
 * Fusion des fonds marins dans la couche unique « earth-hd », faite par le navigateur : là où les altitudes Terrarium
 * (AWS Terrain Tiles, déjà lues par le relief) sont sous la mer, la tuile GEBCO remplace peu à peu l'imagerie
 * satellite — l'eau peu profonde des côtes garde l'image satellite, le large montre le relief des fonds, comme sur
 * Google Earth. Les deux sont prises au niveau 10 au plus : une tuile sert toutes les tuiles affichées qu'elle couvre.
 * `EARTH_SEAFLOOR=0` coupe la fusion.
 */
// Altitudes Terrarium d'AWS : TERRARIUM_URL si elle est définie, sinon l'adresse publique.
const TERRARIUM = process.env.TERRARIUM_URL?.trim() || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
// Niveau maximal des tuiles des fonds et des altitudes lues pour la fusion : 10 (≈ 150 m par pixel à l'équateur).
export const SEAFLOOR_FUSION_MAX_ZOOM = 10;

// Fonction seafloorFusion : le réglage de la fusion pour le navigateur, ou null si elle est coupée ; par défaut, l'environnement du processus.
export function seafloorFusion(env: Record<string, string | undefined> = process.env): { template: string; maxZoom: number; mask: { template: string; maxZoom: number } } | null {
  // EARTH_SEAFLOOR coupé : null.
  if (isOff(env.EARTH_SEAFLOOR)) return null;
  // Renvoie :
  return {
    // les tuiles GEBCO, par le relais de ce serveur, jusqu'au niveau 10 ;
    template: '/api/v1/tiles/earth/earth-gebco/{z}/{x}/{y}', maxZoom: SEAFLOOR_FUSION_MAX_ZOOM,
    // les altitudes Terrarium, jusqu'au niveau 10.
    mask: { template: TERRARIUM, maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
  // Fin de l'objet.
  };
// Fin de seafloorFusion.
}

/** Une couche d'images de la carte marine : modèle d'adresse (relais de ce serveur) et niveau le plus fin demandé. */
// Déclare et exporte la forme d'une couche de la carte marine.
export interface EarthMarineLayer { template: string; maxZoom: number }

/**
 * Carte marine de la couche unique, décrite dans sa table (earth-plan.ts) et faite par le navigateur, sous le masque
 * de la mer des altitudes Terrarium (l'eau peu profonde des côtes garde l'image satellite) :
 *  - vue de l'espace (paliers « noaa » de la table) : NOAA seule ;
 *  - zooms moyens (paliers « fondu ») : NOAA fondue peu à peu vers GEBCO, niveau par niveau ;
 *  - zooms forts (paliers « gebco ») : GEBCO seule.
 * Les seuils sont les distances des paliers de la table ; `fadeMs` est la durée du fondu entre deux niveaux de la
 * Terre (le passage NOAA → GEBCO se fait à ces changements de niveau). Rien n'est gardé sur le serveur.
 */
// Déclare et exporte la forme de la carte marine.
export interface EarthMarine {
  // noaa : la teinte des océans vue de l'espace (NOAA NCEI, ETOPO 2022).
  noaa: EarthMarineLayer;
  // gebco : le relief ombré des fonds (GEBCO_2026).
  gebco: EarthMarineLayer;
  // flat : la carte plate colorée de GEBCO, source des isobathes.
  flat: EarthMarineLayer;
  // mask : les altitudes Terrarium qui disent où est la mer.
  mask: EarthMarineLayer;
  // fadeMs : durée du fondu entre deux niveaux de la Terre, en millisecondes.
  fadeMs: number;
  // isobaths : nombre de bandes de couleur de la carte plate (une isobathe à chaque limite) et force du trait (0 à 1).
  isobaths: { bands: number; strength: number };
  // credits : les mentions des sources de la carte marine, affichées dans la fenêtre Node.
  credits: string[];
// Fin de EarthMarine.
}

// Durée du fondu entre deux niveaux de la Terre, dont le passage GEBCO → NOAA : 600 ms.
export const MARINE_FADE_MS = 600;
// Isobathes : 12 bandes de couleur dans la carte plate, trait foncé à 45 %.
export const ISOBATHS = { bands: 12, strength: 0.45 };

// Modèle d'adresse d'un relais de fond marin de ce serveur.
const relay = (id: string) => `/api/v1/tiles/earth/${id}/{z}/{x}/{y}`;

// Fonction earthMarine : la carte marine pour la table de la couche unique, ou null si EARTH_SEAFLOOR est coupé.
export function earthMarine(env: Record<string, string | undefined> = process.env): EarthMarine | null {
  // Fonds marins coupés : null.
  if (isOff(env.EARTH_SEAFLOOR)) return null;
  // Renvoie :
  return {
    // la NOAA, GEBCO en relief ombré et GEBCO en carte plate, par les relais de ce serveur, jusqu'au niveau 10 ;
    noaa: { template: relay('earth-ncei'), maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
    // GEBCO en relief ombré ;
    gebco: { template: relay('earth-gebco'), maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
    // GEBCO en carte plate ;
    flat: { template: relay('earth-gebco-flat'), maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
    // les altitudes Terrarium, jusqu'au niveau 10 ;
    mask: { template: TERRARIUM, maxZoom: SEAFLOOR_FUSION_MAX_ZOOM },
    // la durée du fondu et les isobathes ;
    fadeMs: MARINE_FADE_MS, isobaths: { ...ISOBATHS },
    // les mentions de la NOAA et de GEBCO.
    credits: [SEAFLOOR_BY_ID.get('earth-ncei')!.source.attribution, GEBCO_CREDIT],
  // Fin de l'objet.
  };
// Fin de earthMarine.
}
