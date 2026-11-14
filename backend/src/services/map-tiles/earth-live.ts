/**
 * « Terre à l'instant T » : image du monde entier assemblée à partir des satellites géostationnaires, rafraîchie
 * toutes les dix minutes. Fonctions pures (testées dans earth-live.spec.ts) : ni NestJS ni réseau.
 *
 * Chaque satellite voit un disque centré sur sa longitude. Le globe est partagé en fuseaux, un par satellite :
 *  - goes-west  GOES-West (137,2° O) : Pacifique Est, de 180° O à 106° O ;
 *  - goes-east  GOES-East (75,2° O)  : Amériques et Atlantique Ouest, de 106° O à 30° O ;
 *  - meteosat   Meteosat (0°)        : Europe, Afrique, Atlantique Est, de 30° O à 65° E ;
 *  - himawari   Himawari (140,7° E)  : Asie, Océanie, Pacifique Ouest, de 65° E à 180° E.
 * Les pôles (au-delà de 81°) sont hors de vue de tous : le fond habituel de la Terre y reste affiché, comme partout où
 * un satellite ne répond pas. Le serveur pose l'image du satellite par-dessus ce fond (voir earth-imagery.service.ts).
 *
 * Adresses :
 *  - GOES : NASA GIBS, service WMS (couche GeoColor : couleurs vraies le jour, infrarouge la nuit ; une image toutes
 *    les 10 minutes, disponible environ 40 minutes après la prise de vue). En secours, la mosaïque « la plus récente »
 *    de la NOAA (NESDIS, tuiles toutes faites, GOES-East et GOES-West réunis).
 *  - Meteosat : EUMETView (EUMETSAT), service WMS, couche GeoColour de Meteosat troisième génération.
 *  - Himawari : NASA GIBS, canal infrarouge (nuages de jour comme de nuit, en niveaux de gris).
 * ⚠ Aucune de ces adresses n'a pu être essayée depuis l'environnement de développement (pas d'accès réseau) : les
 * noms de couches viennent des fiches publiques de la NASA, de la NOAA et d'EUMETSAT. Une source qui échoue ou répond
 * par une image vide laisse la place au fond habituel : la couche reste toujours affichable.
 */
// Emprise d'une tuile en mètres Web Mercator, test « un fuseau touche-t-il une tuile », et type d'une emprise.
import { mercatorBbox, tileTouches, type Bbox } from './earth-sources';

// Identifiant de la couche.
export const LIVE_LAYER_ID = 'earth-live';
/** Les géostationnaires voient au mieux jusqu'à ≈ 81° de latitude ; résolution ≈ 1 km : niveau 7 (1,2 km par pixel). */
// Niveau de zoom maximal de la couche.
export const LIVE_MAX_ZOOM = 7;
// Durée d'un créneau : 10 minutes.
export const LIVE_SLOT_MS = 10 * 60_000;
/** Délai de mise à disposition des images (GeoColor : environ 40 minutes) : on demande l'image d'il y a 50 minutes. */
// Retard des images : 50 minutes.
export const LIVE_LATENCY_MS = 50 * 60_000;

// Type LiveSourceId : l'identifiant d'un satellite, parmi quatre.
export type LiveSourceId = 'goes-west' | 'goes-east' | 'meteosat' | 'himawari';

// Forme d'une source d'images.
export interface LiveSource {
  // id : son identifiant.
  id: LiveSourceId;
  // label : son nom affiché.
  label: string;
  // attribution : sa mention.
  attribution: string;
  /** Fuseau servi par ce satellite, [ouest, sud, est, nord] en degrés. */
  // bbox : le fuseau qu'elle sert.
  bbox: Bbox;
  /** Adresses de la tuile à l'instant `time` (ISO, UTC), dans l'ordre d'essai. */
  // urls : les adresses d'une tuile à un instant, dans l'ordre d'essai.
  urls(z: number, x: number, y: number, time: string): string[];
// Fin de LiveSource.
}

/** Début (ms) du créneau de dix minutes affiché à l'instant `now` : la dernière image sûrement disponible. */
// Fonction liveSlot : début du créneau affiché : maintenant moins 50 minutes, arrondi aux 10 minutes inférieures.
export const liveSlot = (now: number): number => Math.floor((now - LIVE_LATENCY_MS) / LIVE_SLOT_MS) * LIVE_SLOT_MS;

/** Instant d'un créneau au format attendu par les services (« 2026-11-11T19:20:00Z »). */
// Fonction liveTime : l'instant d'un créneau en ISO 8601, sans les millisecondes.
export const liveTime = (slot: number): string => `${new Date(slot).toISOString().slice(0, 19)}Z`;

// Adresse du service WMS de NASA GIBS : GIBS_WMS_URL ou l'adresse officielle, sans « ? » final.
const GIBS_WMS = (process.env.GIBS_WMS_URL?.trim() || 'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi').replace(/\?$/, '');
// Adresse du service WMS d'EUMETSAT : EUMETVIEW_WMS_URL ou l'adresse officielle.
const EUMETVIEW_WMS = (process.env.EUMETVIEW_WMS_URL?.trim() || 'https://view.eumetsat.int/geoserver/wms').replace(/\?$/, '');
// Adresse des tuiles de secours de la NOAA.
const NESDIS_MERGED = 'https://satellitemaps.nesdis.noaa.gov/arcgis/rest/services/MERGEDGC_current/ImageServer/tile';

/** Requête WMS GetMap d'une tuile de 256 px en Web Mercator, fond transparent hors du disque du satellite. */
// Fonction wmsLive : l'adresse WMS d'une tuile.
function wmsLive(base: string, layer: string, z: number, x: number, y: number, time: string | null): string {
  // Début de la requête : service, version, couche, projection Web Mercator et emprise de la tuile ;
  return `${base}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:3857&BBOX=${mercatorBbox(z, x, y)}`
    // fin : 256 × 256 pixels, PNG transparent, et l'instant s'il est donné.
    + `&WIDTH=256&HEIGHT=256&FORMAT=image/png&TRANSPARENT=TRUE${time ? `&TIME=${time}` : ''}`;
// Fin de wmsLive.
}

// Latitude au-delà de laquelle aucun satellite ne voit.
const POLE = 81;

// Les quatre sources :
export const LIVE_SOURCES: LiveSource[] = [
  // première source,
  {
    // GOES-West, de 180° Ouest à 106° Ouest ;
    id: 'goes-west', label: 'GOES-West (GeoColor)', bbox: [-180, -POLE, -106, POLE],
    // sa mention ;
    attribution: 'GOES-West ABI GeoColor — NOAA / NASA GIBS',
    // ses adresses : NASA GIBS, puis la mosaïque de la NOAA (ligne avant colonne).
    urls: (z, x, y, time) => [wmsLive(GIBS_WMS, 'GOES-West_ABI_GeoColor', z, x, y, time), `${NESDIS_MERGED}/${z}/${y}/${x}`],
  // Fin de la première source.
  },
  // Deuxième source,
  {
    // GOES-East, de 106° Ouest à 30° Ouest ;
    id: 'goes-east', label: 'GOES-East (GeoColor)', bbox: [-106, -POLE, -30, POLE],
    // sa mention ;
    attribution: 'GOES-East ABI GeoColor — NOAA / NASA GIBS',
    // ses adresses : NASA GIBS, puis la mosaïque de la NOAA.
    urls: (z, x, y, time) => [wmsLive(GIBS_WMS, 'GOES-East_ABI_GeoColor', z, x, y, time), `${NESDIS_MERGED}/${z}/${y}/${x}`],
  // Fin de la deuxième source.
  },
  // Troisième source,
  {
    // Meteosat, de 30° Ouest à 65° Est ;
    id: 'meteosat', label: 'Meteosat (GeoColour)', bbox: [-30, -POLE, 65, POLE],
    // sa mention ;
    attribution: 'Meteosat MTG FCI GeoColour — © EUMETSAT',
    // D'abord l'image du créneau ; si le service ne connaît pas cet instant exact, sa dernière image.
    // ses adresses : EUMETSAT à l'instant demandé, puis sans instant (la dernière image).
    urls: (z, x, y, time) => [wmsLive(EUMETVIEW_WMS, 'mtg_fd:rgb_geocolour', z, x, y, time), wmsLive(EUMETVIEW_WMS, 'mtg_fd:rgb_geocolour', z, x, y, null)],
  // Fin de la troisième source.
  },
  // Quatrième source,
  {
    // Himawari, de 65° Est à 180° Est ;
    id: 'himawari', label: 'Himawari (infrarouge)', bbox: [65, -POLE, 180, POLE],
    // sa mention ;
    attribution: 'Himawari AHI, infrarouge — JMA / NASA GIBS',
    // son adresse : NASA GIBS, canal infrarouge.
    urls: (z, x, y, time) => [wmsLive(GIBS_WMS, 'Himawari_AHI_Band13_Clean_Infrared', z, x, y, time)],
  // Fin de la quatrième source.
  },
// Fin de la liste.
];

/** Tuile existante de la couche (niveaux 0 à LIVE_MAX_ZOOM) ? */
// Fonction isLiveTile : la tuile existe-t-elle dans cette couche ?
export const isLiveTile = (z: number, x: number, y: number): boolean =>
  // Oui si les trois valeurs sont entières, le niveau entre 0 et 7, et la tuile dans la grille.
  Number.isInteger(z) && Number.isInteger(x) && Number.isInteger(y) && z >= 0 && z <= LIVE_MAX_ZOOM && x >= 0 && y >= 0 && x < 2 ** z && y < 2 ** z;

/**
 * Satellites à interroger pour la tuile (z, x, y), dans l'ordre : ceux dont le fuseau touche la tuile, celui qui en
 * couvre la plus grande largeur d'abord. Aux petits niveaux une tuile chevauche plusieurs fuseaux : les images de
 * tous ses satellites sont superposées (chacune est transparente hors de son disque).
 */
// Fonction liveCandidates : les satellites à interroger pour une tuile.
export function liveCandidates(z: number, x: number, y: number, sources: LiveSource[] = LIVE_SOURCES): LiveSource[] {
  // Nombre de tuiles par côté.
  const n = 2 ** z;
  // Longitudes des bords ouest et est de la tuile.
  const west = (x / n) * 360 - 180, east = ((x + 1) / n) * 360 - 180;
  // Fonction overlap : largeur commune, en degrés, entre la tuile et le fuseau d'une source.
  const overlap = (s: LiveSource) => Math.max(0, Math.min(east, s.bbox[2]) - Math.max(west, s.bbox[0]));
  // Garde les sources dont le fuseau touche la tuile, la plus couvrante d'abord.
  return sources.filter((s) => tileTouches(s.bbox, z, x, y)).sort((a, b) => overlap(b) - overlap(a));
// Fin de liveCandidates.
}

/** Modèle d'adresse du relais pour un créneau : l'instant est dans l'adresse, le navigateur garde chaque image. */
// Fonction liveTemplate : le modèle d'adresse des tuiles d'un créneau ; « t » est le numéro du créneau.
export const liveTemplate = (slot: number): string => `/api/v1/tiles/earth/${LIVE_LAYER_ID}/{z}/{x}/{y}?t=${slot / LIVE_SLOT_MS}`;

/**
 * Fin de validité du modèle d'adresse : le navigateur redemande la fiche de la couche dix minutes avant cette date
 * (voir TileSource.scheduleRefresh), donc au début du créneau suivant.
 */
// Fonction liveExpiry : la date d'expiration du modèle : le créneau, plus le retard, plus deux créneaux.
export const liveExpiry = (slot: number): string => new Date(slot + LIVE_LATENCY_MS + 2 * LIVE_SLOT_MS).toISOString();
