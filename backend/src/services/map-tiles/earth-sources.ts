/**
 * Sources d'imagerie satellite de la Terre réunies dans la couche unique « earth-hd » (voir earth-imagery.service.ts).
 * Fonctions pures, testées dans earth-sources.spec.ts : aucune dépendance à NestJS ni au réseau.
 *
 * Toutes les sources servent des tuiles Web Mercator de 256 px (découpage XYZ). Pour chaque tuile, `candidates`
 * donne les sources utilisables, de la plus détaillée à la moins détaillée ; `hedged` les interroge en cascade
 * rapprochée : la première part seule, la suivante part si la précédente échoue ou tarde, la première réponse gagne.
 *
 * Toutes sans clé, toujours actives :
 *  - orthophotos nationales, niveaux 12 à 18 ou 19, chacune dans l'emprise de son pays : Luxembourg (lu), Suisse (ch),
 *    Belgique (be), Pays-Bas (nl), Autriche (at), Tchéquie (cz), France (ign), Espagne (es), Pologne (pl), Japon (jp),
 *    États-Unis (usgs, niveaux 12 à 16) ;
 *  - pays sans tuiles nationales toutes faites : leur service de carte (WMS) est découpé en tuiles de 256 px, une
 *    requête GetMap par tuile, comme les mosaïques planétaires de l'USGS. Allemagne, Land par Land : Saxe (de-sn),
 *    Hesse (de-he), Rhénanie-du-Nord-Westphalie (de-nw), Bavière (de-by) ; Italie (it, orthophotos 2012) ; Australie,
 *    Nouvelle-Galles du Sud seulement (au-nsw, tuiles toutes faites) ;
 *  - sentinel2 Sentinel-2 cloudless 2016 (EOX, CC BY 4.0) : monde, ≈ 10 m, niveaux 0 à 14 ;
 *  - gibs      NASA GIBS, Blue Marble : monde, niveaux 0 à 8 (secours des petits niveaux).
 * Les emprises sont des rectangles : elles débordent sur les pays voisins et se chevauchent. L'ordre de la liste va du
 * plus petit pays au plus grand, et une source nationale qui répond par une tuile vide (blanche, noire ou transparente :
 * hors de son territoire) passe la main à la suivante sans compter comme une panne (voir isBlank, CoverageMemo).
 * ⚠ Seules les adresses de l'IGN, d'EOX et de GIBS ont été essayées en vrai. Celles des autres pays et de l'USGS
 * (services WMS compris ; celles de Bavière, de Saxe et de Rhénanie-du-Nord-Westphalie sont confirmées par leurs fiches)
 * viennent de la connaissance de ces services : une source qui échoue est mise à l'écart (voir SourceHealth), les
 * autres prennent le relais.
 */

// Type EarthSourceId : l'identifiant d'une source, parmi :
export type EarthSourceId =
  // les pays d'Europe, les Länder allemands et le Japon ;
  | 'lu' | 'ch' | 'be' | 'nl' | 'at' | 'cz' | 'de-sn' | 'de-he' | 'de-nw' | 'de-by' | 'ign' | 'es' | 'it' | 'pl' | 'jp'
  // la Nouvelle-Galles du Sud, les États-Unis, et les deux sources mondiales.
  | 'au-nsw' | 'usgs' | 'sentinel2' | 'gibs';

/** Emprise [ouest, sud, est, nord] en degrés. */
// Type Bbox : quatre nombres.
export type Bbox = [number, number, number, number];

// Forme d'une source d'images.
export interface EarthSource {
  // id : son identifiant.
  id: EarthSourceId;
  // label : son nom affiché.
  label: string;
  // attribution : sa mention.
  attribution: string;
  /** Niveaux servis par la source dans la couche unique. */
  // minZoom : son niveau le moins fin.
  minZoom: number;
  // maxZoom : son niveau le plus fin.
  maxZoom: number;
  /** Emprises couvertes ; absent = monde entier. */
  // bboxes : ses emprises (facultatif).
  bboxes?: Bbox[];
  /** Variable d'environnement de la clé ; absente = source sans clé. */
  // keyEnv : le nom de la variable qui porte sa clé (facultatif).
  keyEnv?: string;
  /** Adresses de la tuile, dans l'ordre d'essai (variantes d'une même source). */
  // urls : fonction qui donne les adresses d'une tuile.
  urls(z: number, x: number, y: number, key: string): string[];
  /**
   * Modèles d'adresse ({z}, {x}, {y}) que le navigateur peut charger lui-même, sans passer par ce serveur : sources
   * sans clé, en tuiles toutes faites, qui autorisent les autres sites (en-tête CORS). Absent : la tuile est relayée
   * (services WMS, dont l'emprise se calcule tuile par tuile).
   */
  // direct : ses modèles d'adresse pour le navigateur (facultatif).
  direct?: string[];
  /**
   * Vue de loin : niveau le plus haut où le fournisseur sert encore sa propre mosaïque réduite (il la découpe lui-même
   * en tuiles, comme la mosaïque de la Lune). Entre `lowZoom` et `minZoom`, le navigateur pose cette source par-dessus
   * l'image du monde là où elle a une image : le pays garde son imagerie détaillée vu de loin. Absent : pas de vue
   * de loin pour cette source (services WMS, source déjà mondiale aux petits niveaux).
   */
  // lowZoom : son niveau de vue de loin (facultatif).
  lowZoom?: number;
// Fin de EarthSource.
}

/** Remplit un modèle d'adresse {z}/{x}/{y}. */
// Fonction fillTemplate.
export const fillTemplate = (template: string, z: number, x: number, y: number) =>
  // Remplace tous les {z}, {x} et {y} par leurs valeurs.
  template.replace(/\{z\}/g, String(z)).replace(/\{x\}/g, String(x)).replace(/\{y\}/g, String(y));

/** Source en tuiles toutes faites : les mêmes modèles servent au serveur (`urls`) et au navigateur (`direct`). */
// Fonction xyz : fabrique les champs direct et urls d'une source en tuiles toutes faites.
const xyz = (templates: string[]): Pick<EarthSource, 'urls' | 'direct'> => ({
  // direct : les modèles tels quels.
  direct: templates,
  // urls : chaque modèle rempli pour la tuile.
  urls: (z, x, y) => templates.map((t) => fillTemplate(t, z, x, y)),
// Fin de xyz.
});

/** France métropolitaine et Corse. */
// Emprise de la France.
export const FRANCE: Bbox = [-5.5, 41.2, 9.8, 51.2];
/**
 * Départements et régions d'outre-mer, dans l'ordre : Guadeloupe (Basse-Terre, Grande-Terre, Marie-Galante, les
 * Saintes et la Désirade en une seule emprise), Martinique, Guyane, La Réunion et Mayotte (Grande-Terre et
 * Petite-Terre). Emprises relevées sur les contours Natural Earth embarqués dans le dépôt, élargies d'environ 6 km.
 */
// Les cinq emprises de l'outre-mer.
export const FRANCE_OUTRE_MER: Bbox[] = [
  // Guadeloupe et ses dépendances.
  [-61.85, 15.83, -61.1, 16.57],
  // Martinique.
  [-61.28, 14.37, -60.77, 14.94],
  // Guyane.
  [-54.68, 2.06, -51.59, 5.84],
  // La Réunion.
  [55.17, -21.43, 55.9, -20.81],
  // Mayotte.
  [44.98, -13.04, 45.32, -12.59],
// Fin des emprises de l'outre-mer.
];
/** États-Unis : 48 États contigus, Alaska, Hawaï, Porto Rico. */
// Les quatre emprises des États-Unis.
export const USA: Bbox[] = [[-125, 24, -66.5, 49.5], [-170, 51, -129, 71.5], [-161, 18.5, -154.5, 22.5], [-67.5, 17.6, -65.2, 18.6]];

// Emprise du Luxembourg.
export const LUXEMBOURG: Bbox = [5.7, 49.4, 6.55, 50.2];
// Emprise de la Suisse.
export const SUISSE: Bbox = [5.9, 45.8, 10.5, 47.85];
// Emprise de la Belgique.
export const BELGIQUE: Bbox = [2.5, 49.45, 6.45, 51.55];
// Emprise des Pays-Bas.
export const PAYS_BAS: Bbox = [3.3, 50.7, 7.25, 53.6];
// Emprise de l'Autriche.
export const AUTRICHE: Bbox = [9.5, 46.35, 17.2, 49.05];
// Emprise de la Tchéquie.
export const TCHEQUIE: Bbox = [12.05, 48.5, 18.9, 51.1];
/** Péninsule et Baléares, puis Canaries. */
// Les deux emprises de l'Espagne.
export const ESPAGNE: Bbox[] = [[-9.4, 35.9, 4.4, 43.85], [-18.3, 27.5, -13.3, 29.5]];
// Emprise de la Pologne.
export const POLOGNE: Bbox = [14.1, 49.0, 24.2, 54.9];
// Emprise du Japon.
export const JAPON: Bbox = [122.9, 24, 146, 45.6];
// Emprise de la Saxe.
export const SAXE: Bbox = [11.85, 50.15, 15.05, 51.7];
// Emprise de la Hesse.
export const HESSE: Bbox = [7.75, 49.38, 10.25, 51.67];
// Emprise de la Rhénanie-du-Nord-Westphalie.
export const RHENANIE_NORD_WESTPHALIE: Bbox = [5.85, 50.3, 9.5, 52.55];
// Emprise de la Bavière.
export const BAVIERE: Bbox = [8.95, 47.25, 13.85, 50.6];
/** Péninsule, Sicile et Sardaigne. */
// Emprise de l'Italie.
export const ITALIE: Bbox = [6.6, 36.6, 18.6, 47.1];
// Emprise de la Nouvelle-Galles du Sud.
export const NOUVELLE_GALLES_DU_SUD: Bbox = [140.99, -37.6, 153.7, -28.1];

// Demi-largeur du monde en mètres Web Mercator.
const HALF_WORLD = 20037508.342789244;
/** Emprise Web Mercator (EPSG:3857) « minx,miny,maxx,maxy » de la tuile : paramètre BBOX d'une requête WMS. */
// Fonction mercatorBbox.
export function mercatorBbox(z: number, x: number, y: number): string {
  // Côté d'une tuile, en mètres.
  const size = (2 * HALF_WORLD) / 2 ** z;
  // Bord ouest et bord nord de la tuile.
  const minx = -HALF_WORLD + x * size, maxy = HALF_WORLD - y * size;
  // Renvoie ouest, sud, est, nord, avec 3 décimales, séparés par des virgules.
  return [minx, maxy - size, minx + size, maxy].map((v) => v.toFixed(3)).join(',');
// Fin de mercatorBbox.
}
/**
 * Tuile de 256 px découpée dans un service WMS, en Web Mercator : une requête GetMap sur l'emprise de la tuile.
 * `base` peut déjà porter des paramètres (« ?map=… »). WMS 1.1.1 (paramètre SRS) pour les services qui n'annoncent
 * pas la version 1.3.0 ; en EPSG:3857 l'ordre des axes est le même dans les deux versions.
 */
// Fonction wms : l'adresse d'une tuile dans un service WMS ; version 1.3.0 par défaut.
const wms = (base: string, layer: string, z: number, x: number, y: number, version: '1.3.0' | '1.1.1' = '1.3.0') =>
  // La base, suivie de « & » si elle a déjà un « ? » et de « ? » sinon, puis le service, la version, la requête, la couche, aucun style ;
  `${base}${base.includes('?') ? '&' : '?'}SERVICE=WMS&VERSION=${version}&REQUEST=GetMap&LAYERS=${layer}&STYLES=`
  // puis la projection (CRS en 1.3.0, SRS en 1.1.1), l'emprise, 256 × 256 pixels, et le format JPEG.
  + `&${version === '1.3.0' ? 'CRS' : 'SRS'}=EPSG:3857&BBOX=${mercatorBbox(z, x, y)}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg`;

// Adresse de NASA GIBS : GIBS_BASE_URL si elle est définie, sinon l'adresse officielle ; la barre finale est retirée.
const GIBS_BASE = (process.env.GIBS_BASE_URL?.trim() || 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best').replace(/\/$/, '');
// Mosaïque 2016 (CC BY 4.0) : l'identifiant d'origine est « s2cloudless_3857 » ; « s2cloudless-2016_3857 » en secours.
// Les deux noms de la couche d'EOX, dans l'ordre d'essai.
const EOX_LAYERS = ['s2cloudless_3857', 's2cloudless-2016_3857'];

/**
 * Ordre = priorité : la source la plus détaillée disponible pour la tuile est essayée d'abord. Entre orthophotos
 * nationales, du plus petit pays au plus grand : dans une zone où deux rectangles se chevauchent, le pays le plus
 * probable est demandé en premier.
 */
// Liste des sources :
export const EARTH_SOURCES: EarthSource[] = [
  // Luxembourg,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19, dans son emprise ;
    id: 'lu', label: 'Orthophotos du Luxembourg', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [LUXEMBOURG],
    // sa mention ;
    attribution: 'Orthophotos © Administration du cadastre et de la topographie, Luxembourg (CC0)',
    // tuiles toutes faites du géoportail.
    ...xyz(['https://wmts1.geoportail.lu/opendata/wmts/ortho_latest/GLOBAL_WEBMERCATOR_4_V3/{z}/{x}/{y}.jpeg']),
  // Fin du Luxembourg.
  },
  // Suisse,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'ch', label: 'SWISSIMAGE (swisstopo)', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [SUISSE],
    // sa mention ;
    attribution: 'SWISSIMAGE © swisstopo',
    // tuiles toutes faites de swisstopo.
    ...xyz(['https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg']),
  // Fin de la Suisse.
  },
  // Belgique,
  {
    // niveaux 12 à 19, sans vue de loin ;
    id: 'be', label: 'Orthophotos de Belgique (IGN/NGI)', minZoom: 12, maxZoom: 19, bboxes: [BELGIQUE],
    // sa mention ;
    attribution: 'Orthophotos © Institut géographique national de Belgique (IGN/NGI)',
    // service WMS de l'IGN belge, découpé tuile par tuile.
    urls: (z, x, y) => [wms('https://wms.ngi.be/inspire/ortho/service', 'orthoimage_coverage', z, x, y)],
  // Fin de la Belgique.
  },
  // Pays-Bas,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'nl', label: 'Luchtfoto (PDOK)', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [PAYS_BAS],
    // sa mention ;
    attribution: 'Luchtfoto © PDOK / Beeldmateriaal Nederland (CC BY 4.0)',
    // deux couches, la haute résolution puis celle à 25 cm,
    ...xyz(['Actueel_orthoHR', 'Actueel_ortho25']
      // en tuiles toutes faites de PDOK.
      .map((layer) => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/${layer}/EPSG:3857/{z}/{x}/{y}.jpeg`)),
  // Fin des Pays-Bas.
  },
  // Autriche,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'at', label: 'Orthofoto (basemap.at)', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [AUTRICHE],
    // sa mention ;
    attribution: 'Orthofoto © basemap.at (CC BY 4.0)',
    // deux serveurs, le nouveau puis l'ancien,
    ...xyz(['mapsneu.wien.gv.at', 'maps.wien.gv.at']
      // en tuiles toutes faites (ligne avant colonne).
      .map((host) => `https://${host}/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg`)),
  // Fin de l'Autriche.
  },
  // Tchéquie,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'cz', label: 'Ortofoto ČÚZK', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [TCHEQUIE],
    // sa mention ;
    attribution: 'Ortofoto © ČÚZK (CC BY 4.0)',
    // deux serveurs,
    ...xyz(['ags.cuzk.gov.cz', 'ags.cuzk.cz']
      // en tuiles toutes faites (ligne avant colonne).
      .map((host) => `https://${host}/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/{z}/{y}/{x}`)),
  // Fin de la Tchéquie.
  },
  // Saxe,
  {
    // niveaux 12 à 19 ;
    id: 'de-sn', label: 'DOP Saxe (GeoSN)', minZoom: 12, maxZoom: 19, bboxes: [SAXE],
    // sa mention ;
    attribution: 'Digitale Orthophotos © GeoSN, Saxe (dl-de/by-2-0)',
    // service WMS 1.1.1 de GeoSN.
    urls: (z, x, y) => [wms('https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest', 'sn_dop_020', z, x, y, '1.1.1')],
  // Fin de la Saxe.
  },
  // Hesse,
  {
    // niveaux 12 à 19 ;
    id: 'de-he', label: 'DOP20 Hesse (HVBG)', minZoom: 12, maxZoom: 19, bboxes: [HESSE],
    // sa mention ;
    attribution: 'Digitale Orthophotos © Hessische Verwaltung für Bodenmanagement und Geoinformation (dl-de/zero-2-0)',
    // service WMS 1.1.1 de la Hesse.
    urls: (z, x, y) => [wms('https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows', 'he_dop20_rgb', z, x, y, '1.1.1')],
  // Fin de la Hesse.
  },
  // Rhénanie-du-Nord-Westphalie,
  {
    // niveaux 12 à 19 ;
    id: 'de-nw', label: 'DOP Rhénanie-du-Nord-Westphalie (Geobasis NRW)', minZoom: 12, maxZoom: 19, bboxes: [RHENANIE_NORD_WESTPHALIE],
    // sa mention ;
    attribution: 'Digitale Orthophotos © Geobasis NRW (dl-de/zero-2-0)',
    // service WMS 1.1.1 de Geobasis NRW.
    urls: (z, x, y) => [wms('https://www.wms.nrw.de/geobasis/wms_nw_dop', 'nw_dop_rgb', z, x, y, '1.1.1')],
  // Fin de la Rhénanie-du-Nord-Westphalie.
  },
  // Bavière,
  {
    // niveaux 12 à 19 ;
    id: 'de-by', label: 'DOP20 Bavière (LDBV)', minZoom: 12, maxZoom: 19, bboxes: [BAVIERE],
    // sa mention ;
    attribution: 'Digitale Orthophotos © Bayerische Vermessungsverwaltung — www.geodaten.bayern.de (CC BY 4.0)',
    // service WMS 1.1.1 de la Bavière.
    urls: (z, x, y) => [wms('https://geoservices.bayern.de/od/wms/dop/v1/dop20', 'by_dop20c', z, x, y, '1.1.1')],
  // Fin de la Bavière.
  },
  // France,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'ign', label: 'Orthophotos IGN', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [FRANCE],
    // sa mention ;
    attribution: 'Orthophotos © IGN — Géoplateforme (Licence Ouverte 2.0)',
    // tuiles toutes faites, un seul modèle :
    ...xyz([
      // début de la requête WMTS de la Géoplateforme : la couche des orthophotos ;
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal'
      // fin : le jeu de tuiles PM, le format JPEG et les trous.
      + '&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    // Fin du modèle.
    ]),
  // Fin de la France.
  },
  // Espagne,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19, dans ses deux emprises ;
    id: 'es', label: 'PNOA (IGN Espagne)', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: ESPAGNE,
    // sa mention ;
    attribution: 'PNOA © Instituto Geográfico Nacional de España (CC BY 4.0)',
    // tuiles toutes faites, un seul modèle :
    ...xyz([
      // début de la requête WMTS de l'IGN espagnol : la couche PNOA ;
      'https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default'
      // fin : le jeu de tuiles, le format JPEG et les trous.
      + '&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
    // Fin du modèle.
    ]),
  // Fin de l'Espagne.
  },
  // Italie,
  {
    // niveaux 12 à 18 ;
    id: 'it', label: 'Ortofoto 2012 (Geoportale Nazionale)', minZoom: 12, maxZoom: 18, bboxes: [ITALIE],
    // sa mention ;
    attribution: 'Ortofoto 2012 © Ministero dell’Ambiente e della Sicurezza Energetica — Geoportale Nazionale',
    // service WMS du Geoportale Nazionale, dont l'adresse porte déjà un paramètre.
    urls: (z, x, y) => [wms('https://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map', 'OI.ORTOIMMAGINI.2012', z, x, y)],
  // Fin de l'Italie.
  },
  // Pologne,
  {
    // niveaux 12 à 19 ;
    id: 'pl', label: 'Ortofotomapa (Geoportal.gov.pl)', minZoom: 12, maxZoom: 19, bboxes: [POLOGNE],
    // sa mention ;
    attribution: 'Ortofotomapa © GUGiK — Geoportal.gov.pl',
    // service WMS du Geoportal.
    urls: (z, x, y) => [wms('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution', 'Raster', z, x, y)],
  // Fin de la Pologne.
  },
  // Japon,
  {
    // vue de loin dès le niveau 9, niveaux 12 à 18 ;
    id: 'jp', label: 'Photos aériennes GSI (Japon)', lowZoom: 9, minZoom: 12, maxZoom: 18, bboxes: [JAPON],
    // sa mention ;
    attribution: 'Photos aériennes — Geospatial Information Authority of Japan (GSI)',
    // tuiles toutes faites du GSI.
    ...xyz(['https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg']),
  // Fin du Japon.
  },
  // Nouvelle-Galles du Sud,
  {
    // vue de loin dès le niveau 8, niveaux 12 à 19 ;
    id: 'au-nsw', label: 'NSW Imagery (Australie)', lowZoom: 8, minZoom: 12, maxZoom: 19, bboxes: [NOUVELLE_GALLES_DU_SUD],
    // sa mention ;
    attribution: 'NSW Imagery © State of New South Wales, Spatial Services (CC BY 4.0)',
    // tuiles toutes faites (ligne avant colonne).
    ...xyz(['https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Imagery/MapServer/tile/{z}/{y}/{x}']),
  // Fin de la Nouvelle-Galles du Sud.
  },
  // États-Unis,
  {
    // niveaux 12 à 16, dans leurs quatre emprises ;
    id: 'usgs', label: 'USGS The National Map', minZoom: 12, maxZoom: 16, bboxes: USA,
    // leur mention ;
    attribution: 'USGS The National Map : Orthoimagery (domaine public)',
    // tuiles toutes faites de l'USGS (ligne avant colonne).
    ...xyz(['https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}']),
  // Fin des États-Unis.
  },
  // Sentinel-2,
  {
    // niveaux 0 à 14, monde entier ;
    id: 'sentinel2', label: 'Sentinel-2 cloudless (EOX)', minZoom: 0, maxZoom: 14,
    // sa mention ;
    attribution: 'Sentinel-2 cloudless — s2maps.eu par EOX IT Services GmbH (données Copernicus Sentinel modifiées 2016), CC BY 4.0',
    // un modèle par nom de couche d'EOX (ligne avant colonne).
    ...xyz(EOX_LAYERS.map((layer) => `https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/{z}/{y}/{x}.jpg`)),
  // Fin de Sentinel-2.
  },
  // NASA GIBS,
  {
    // niveaux 0 à 8, monde entier ;
    id: 'gibs', label: 'NASA GIBS Blue Marble', minZoom: 0, maxZoom: 8,
    // sa mention ;
    attribution: 'NASA EOSDIS GIBS — Blue Marble',
    // tuiles du Blue Marble (ligne avant colonne).
    ...xyz([`${GIBS_BASE}/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg`]),
  // Fin de NASA GIBS.
  },
// Fin de la liste.
];

// Table qui donne une source à partir de son identifiant.
export const EARTH_SOURCE_BY_ID = new Map(EARTH_SOURCES.map((s) => [s.id, s]));

/** Une source telle que le navigateur la reçoit : de quoi choisir la source d'une tuile et la charger lui-même. */
// Forme d'une source vue par le navigateur : identifiant, niveaux, emprises, modèles d'adresse et vue de loin.
export interface DirectSource { id: EarthSourceId; minZoom: number; maxZoom: number; bboxes?: Bbox[]; templates?: string[]; lowZoom?: number }

/**
 * Plan de chargement direct, dans l'ordre de priorité du serveur : toutes les sources actives (le navigateur doit
 * connaître aussi celles qu'il ne peut pas charger lui-même, pour leur laisser la tuile), avec leurs modèles d'adresse
 * quand elles sont chargeables sans relais. Une source à clé n'est jamais donnée en direct : la clé reste ici.
 * `EARTH_DIRECT=0` coupe le chargement direct (tout repasse par le relais).
 * `EARTH_FAR_ORTHO=0` coupe la vue de loin (les sources nationales ne servent plus qu'à partir de leur niveau natif).
 */
// Fonction directPlan ; par défaut : les sources actives et l'environnement du processus.
export function directPlan(sources: EarthSource[] = enabledSources(), env: Record<string, string | undefined> = process.env): DirectSource[] | null {
  // EARTH_DIRECT coupé : null.
  if (isOff(env.EARTH_DIRECT)) return null;
  // Vue de loin active, sauf si EARTH_FAR_ORTHO est coupé.
  const far = !isOff(env.EARTH_FAR_ORTHO);
  // Pour chaque source :
  return sources.map((s) => {
    // chargeable en direct si elle a des modèles et pas de clé ;
    const direct = Boolean(s.direct?.length) && !s.keyEnv;
    // renvoie
    return {
      // son identifiant et ses niveaux ;
      id: s.id, minZoom: s.minZoom, maxZoom: s.maxZoom,
      // ses emprises, si elle en a ;
      ...(s.bboxes ? { bboxes: s.bboxes } : {}),
      // ses modèles, si elle est chargeable en direct ;
      ...(direct ? { templates: s.direct } : {}),
      // sa vue de loin, si elle est chargeable en direct, que la vue de loin est active, et qu'elle a des emprises et un niveau de vue de loin plus bas que son niveau natif.
      ...(direct && far && s.bboxes && s.lowZoom !== undefined && s.lowZoom < s.minZoom ? { lowZoom: s.lowZoom } : {}),
    // Fin de l'objet.
    };
  // Fin de la boucle.
  });
// Fin de directPlan.
}

/** Interrupteur d'environnement coupé ? (« 0 », « off », « false », « non ») */
// Fonction isOff : vrai si la valeur, sans ses espaces, vaut 0, off, false ou non (majuscules ou minuscules).
export const isOff = (value: string | undefined) => /^(0|off|false|non)$/i.test(value?.trim() ?? '');

// Fonction lon : longitude du bord ouest de la colonne x.
const lon = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
// Fonction lat : latitude du bord nord de la ligne y (formule du Web Mercator).
const lat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** La tuile touche-t-elle l'emprise ? */
// Fonction tileTouches.
export function tileTouches(bbox: Bbox, z: number, x: number, y: number): boolean {
  // Les quatre bords de l'emprise.
  const [w, s, e, n] = bbox;
  // Vrai si la tuile et l'emprise se recouvrent en longitude et en latitude.
  return lon(x + 1, z) > w && lon(x, z) < e && lat(y + 1, z) < n && lat(y, z) > s;
// Fin de tileTouches.
}

/** Clé d'une source (chaîne vide = source sans clé ; null = clé requise mais absente). */
// Fonction sourceKey.
export function sourceKey(s: EarthSource, env: Record<string, string | undefined> = process.env): string | null {
  // Source sans clé : chaîne vide.
  if (!s.keyEnv) return '';
  // Sinon la valeur de sa variable, ou null si elle est vide.
  return env[s.keyEnv]?.trim() || null;
// Fin de sourceKey.
}

/** Sources actives : sans clé, ou dont la clé est fournie. */
// Fonction enabledSources.
export function enabledSources(env: Record<string, string | undefined> = process.env): EarthSource[] {
  // Garde les sources dont la clé n'est pas manquante.
  return EARTH_SOURCES.filter((s) => sourceKey(s, env) !== null);
// Fin de enabledSources.
}

/**
 * Sources capables de servir nativement la tuile (z, x, y), de la plus détaillée à la moins détaillée.
 * `usable(id)` écarte les sources mises à l'écart (pannes) ; si toutes le sont, on les garde toutes : mieux vaut
 * réessayer une source en panne que ne rien tenter.
 */
// Fonction candidates ; ses paramètres :
export function candidates(
  // la tuile ;
  z: number, x: number, y: number,
  // les sources (par défaut : les actives) ;
  sources: EarthSource[] = enabledSources(),
  // le test « utilisable » (par défaut : toujours oui).
  usable: (id: EarthSourceId) => boolean = () => true,
// Elle renvoie une liste de sources.
): EarthSource[] {
  // Sources dont les niveaux contiennent z, et qui sont mondiales ou dont une emprise touche la tuile.
  const all = sources.filter((s) => z >= s.minZoom && z <= s.maxZoom && (!s.bboxes || s.bboxes.some((b) => tileTouches(b, z, x, y))));
  // Parmi elles, celles qui sont utilisables.
  const healthy = all.filter((s) => usable(s.id));
  // S'il y en a, les renvoie ; sinon renvoie toutes.
  return healthy.length ? healthy : all;
// Fin de candidates.
}

/** Niveau natif le plus fin que peut servir au moins une source, pour l'emplacement de la tuile (z, x, y). */
// Fonction nativeDepth.
export function nativeDepth(z: number, x: number, y: number, sources: EarthSource[], maxCrop: number): number | null {
  // Remonte d'un niveau à la fois, sans dépasser maxCrop ni le niveau 0 :
  for (let d = 0; d <= maxCrop && z - d >= 0; d++) {
    // si une source sert l'ancêtre, renvoie le nombre de niveaux remontés.
    if (candidates(z - d, x >> d, y >> d, sources).length) return d;
  // Fin de la boucle.
  }
  // Aucune : null.
  return null;
// Fin de nativeDepth.
}

// ------------------------------------------------------------------ tuiles vides (hors du territoire d'une source)

/** Une source nationale a répondu par une tuile vide : l'endroit est hors de son territoire. Pas une panne. */
// Classe NoCoverageError.
export class NoCoverageError extends Error {
  // Constructeur : message « <source> : hors couverture ».
  constructor(source: string) { super(`${source} : hors couverture`); }
// Fin de la classe.
}

/**
 * Réponses qui veulent dire « pas de tuile ici » : la source fonctionne, elle n'a simplement rien à cet endroit
 * (mer, pays voisin dans son emprise rectangulaire, millésime sans cette dalle). Ce n'est pas une panne.
 */
// Fonction isAbsentStatus : vrai pour les codes 404, 204 et 410.
export const isAbsentStatus = (status: number): boolean => status === 404 || status === 204 || status === 410;

/** Tuile absente chez une source (voir isAbsentStatus). */
// Classe TileAbsentError.
export class TileAbsentError extends Error {
  // Constructeur : garde le code, et fait le message « HTTP <code> <détail> ».
  constructor(readonly status: number, detail = '') { super(`HTTP ${status} ${detail}`.trim()); }
// Fin de la classe.
}

/** Statistiques d'un canal d'image (forme renvoyée par sharp().stats()). */
// Forme des statistiques d'un canal : moyenne et écart type.
export interface ChannelStats { mean: number; stdev: number }

/**
 * Tuile vide ? Vrai pour une image presque entièrement transparente, ou unie et presque blanche ou presque noire :
 * c'est ce que renvoient les services nationaux hors de leur territoire. Une vraie photo aérienne n'est jamais unie
 * à ce point. `channels` : rouge, vert, bleu, puis alpha s'il existe.
 */
// Fonction isBlank.
export function isBlank(channels: ChannelStats[]): boolean {
  // Moins de trois canaux : faux.
  if (channels.length < 3) return false;
  // Un canal alpha de moyenne sous 13 : vrai.
  if (channels.length >= 4 && channels[3].mean < 13) return true; // plus de 95 % de transparence
  // Les trois canaux de couleur.
  const rgb = channels.slice(0, 3);
  // Image unie : écart type sous 3 dans chacun.
  const flat = rgb.every((c) => c.stdev < 3);
  // Vrai si elle est unie et presque blanche (moyennes au-dessus de 245) ou presque noire (sous 10).
  return flat && (rgb.every((c) => c.mean > 245) || rgb.every((c) => c.mean < 10));
// Fin de isBlank.
}

/**
 * Mémoire des tuiles vides par source : si une source n'a rien pour une tuile, elle n'a rien non plus pour ses
 * descendantes. On ne lui redemande donc aucune des tuiles plus fines du même endroit.
 */
// Classe CoverageMemo.
export class CoverageMemo {
  // Ensemble des tuiles vides, sous la forme « source/z/x/y ».
  private readonly empty = new Set<string>();

  // Constructeur : capacité de 20 000 tuiles par défaut.
  constructor(private readonly capacity = 20_000) {}

  // Méthode mark : note une tuile vide.
  mark(id: EarthSourceId, z: number, x: number, y: number): void {
    // L'ajoute à l'ensemble.
    this.empty.add(`${id}/${z}/${x}/${y}`);
    // Capacité dépassée : retire la plus ancienne.
    if (this.empty.size > this.capacity) this.empty.delete(this.empty.values().next().value!);
  // Fin de mark.
  }

  /** La tuile, ou l'un de ses ancêtres jusqu'au niveau `minZoom`, a-t-elle été vue vide pour cette source ? */
  // Méthode isEmpty.
  isEmpty(id: EarthSourceId, z: number, x: number, y: number, minZoom: number): boolean {
    // Remonte de la tuile vers ses ancêtres, jusqu'à minZoom :
    for (let d = 0; z - d >= minZoom && z - d >= 0; d++) {
      // si l'un est noté vide : vrai.
      if (this.empty.has(`${id}/${z - d}/${x >> d}/${y >> d}`)) return true;
    // Fin de la boucle.
    }
    // Sinon : faux.
    return false;
  // Fin de isEmpty.
  }
// Fin de la classe.
}

// ------------------------------------------------------------------ santé des sources

// Nombre d'échecs d'affilée avant mise à l'écart : 3.
const OPEN_AFTER_FAILURES = 3;
// Durée de la mise à l'écart : 60 secondes.
const OPEN_MS = 60_000;

/**
 * Coupe-circuit par source : après 3 échecs d'affilée, la source est écartée pendant une minute (plus d'attente du
 * délai d'expiration à chaque tuile), puis réessayée. Garde aussi la latence moyenne (journal, diagnostic).
 */
// Classe SourceHealth.
export class SourceHealth {
  // État de chaque source : échecs d'affilée, fin de la mise à l'écart, latence moyenne, nombre de réussites et d'échecs.
  private readonly state = new Map<EarthSourceId, { failures: number; openUntil: number; ms: number; ok: number; ko: number }>();

  // Constructeur : l'horloge, Date.now par défaut.
  constructor(private readonly now: () => number = Date.now) {}

  // Méthode privée of : l'état d'une source.
  private of(id: EarthSourceId) {
    // Le cherche.
    let s = this.state.get(id);
    // Absent : le crée à zéro.
    if (!s) this.state.set(id, (s = { failures: 0, openUntil: 0, ms: 0, ok: 0, ko: 0 }));
    // Le renvoie.
    return s;
  // Fin de of.
  }

  // Méthode usable : vrai si la mise à l'écart est finie.
  usable(id: EarthSourceId): boolean { return this.now() >= this.of(id).openUntil; }

  // Méthode success : note une réussite.
  success(id: EarthSourceId, ms: number): void {
    // État de la source.
    const s = this.of(id);
    // Remet les échecs d'affilée à zéro.
    s.failures = 0;
    // Lève la mise à l'écart.
    s.openUntil = 0;
    // Compte la réussite.
    s.ok++;
    // Latence moyenne : se rapproche de 20 % de la nouvelle mesure ; la première mesure est prise telle quelle.
    s.ms = s.ms ? s.ms + 0.2 * (ms - s.ms) : ms;
  // Fin de success.
  }

  /** Renvoie true quand cet échec vient d'écarter la source. */
  // Méthode failure : note un échec.
  failure(id: EarthSourceId): boolean {
    // État de la source.
    const s = this.of(id);
    // Compte l'échec.
    s.ko++;
    // Moins de 3 échecs d'affilée : faux.
    if (++s.failures < OPEN_AFTER_FAILURES) return false;
    // La source était-elle encore utilisable ?
    const opened = this.now() >= s.openUntil;
    // L'écarte pour une minute.
    s.openUntil = this.now() + OPEN_MS;
    // Renvoie vrai si elle vient d'être écartée.
    return opened;
  // Fin de failure.
  }

  // Méthode snapshot : l'état de toutes les sources.
  snapshot(): Array<{ id: EarthSourceId; usable: boolean; ok: number; failed: number; averageMs: number }> {
    // Pour chacune : son identifiant, si elle est utilisable, ses réussites, ses échecs et sa latence moyenne arrondie.
    return [...this.state.entries()].map(([id, s]) => ({ id, usable: this.usable(id), ok: s.ok, failed: s.ko, averageMs: Math.round(s.ms) }));
  // Fin de snapshot.
  }
// Fin de la classe.
}

// ------------------------------------------------------------------ cascade rapprochée

/**
 * Lance les tâches en cascade rapprochée (« hedged requests ») : la première part tout de suite ; la suivante part
 * dès qu'une tâche en cours échoue, ou au bout de `delayMs` si aucune n'a encore répondu. La première réussite gagne
 * et les autres sont annulées (`signal`). Rejette avec la dernière erreur si toutes échouent.
 * `index` : rang de la tâche gagnante (0 = la préférée).
 */
// Fonction hedged ; ses paramètres :
export function hedged<T>(
  // les tâches, qui reçoivent chacune un signal d'annulation ;
  tasks: Array<(signal: AbortSignal) => Promise<T>>,
  // le délai entre deux départs.
  delayMs: number,
// Elle renvoie la valeur et le rang de la tâche gagnante.
): Promise<{ value: T; index: number }> {
  // Crée la promesse :
  return new Promise((resolve, reject) => {
    // aucune tâche : rejet immédiat.
    if (!tasks.length) { reject(new Error('aucune source')); return; }
    // Contrôleurs d'annulation des tâches lancées.
    const controllers: AbortController[] = [];
    // Rang de la prochaine tâche, nombre de tâches en cours, indicateur de fin.
    let next = 0, running = 0, done = false;
    // Minuterie du prochain départ.
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Dernière erreur.
    let lastError: unknown = new Error('aucune source');

    // Fonction finish : termine.
    const finish = () => {
      // Marque la fin.
      done = true;
      // Arrête la minuterie.
      if (timer) clearTimeout(timer);
    // Fin de finish.
    };
    // Fonction start : lance la tâche suivante.
    const start = () => {
      // Rien à faire si c'est fini ou s'il n'en reste pas.
      if (done || next >= tasks.length) return;
      // Rang de cette tâche ; avance le compteur.
      const index = next++;
      // Son contrôleur d'annulation.
      const ctrl = new AbortController();
      // Le garde.
      controllers.push(ctrl);
      // Une tâche en cours de plus.
      running++;
      // Arrête la minuterie en cours.
      if (timer) clearTimeout(timer);
      // S'il reste une tâche, programme son départ après le délai.
      if (next < tasks.length) timer = setTimeout(start, delayMs);
      // Sur une promesse déjà tenue,
      Promise.resolve()
        // lance la tâche avec son signal ;
        .then(() => tasks[index](ctrl.signal))
        // si elle réussit :
        .then((value) => {
          // trop tard si c'est fini ;
          if (done) return;
          // termine ;
          finish();
          // annule toutes les autres ;
          controllers.forEach((c, i) => { if (i !== index) c.abort(); });
          // rend la valeur et le rang.
          resolve({ value, index });
        // Si elle échoue :
        }, (e) => {
          // une tâche en cours de moins ;
          running--;
          // rien à faire si c'est fini ;
          if (done) return;
          // garde l'erreur ;
          lastError = e;
          // s'il reste une tâche, la lance tout de suite ;
          if (next < tasks.length) start();
          // sinon, si plus rien ne tourne, termine et rejette avec la dernière erreur.
          else if (running === 0) { finish(); reject(lastError); }
        // Fin du traitement.
        });
    // Fin de start.
    };
    // Lance la première tâche.
    start();
  // Fin de la promesse.
  });
// Fin de hedged.
}
