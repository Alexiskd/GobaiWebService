// Format commun, identifiants, rayon de la Terre.
import { AtmosphericEvent, EARTH_RADIUS_KM, makeEventId } from './atmospheric-event';
// Image décodée (pixels RVBA).
import type { DecodedPng } from './png';

// Aérosols (AerosolEngine, partie données). Deux natures de données, jamais mélangées :
//  - OBSERVÉ : l'épaisseur optique des aérosols à 550 nm (AOD) mesurée par VIIRS (Deep Blue, satellites NOAA-20 et
//    NOAA-21) et l'indice d'aérosols absorbants (poussières, fumées) mesuré par OMPS, en images quotidiennes de NASA
//    GIBS. Chaque couleur des images est reconvertie en valeur grâce à la table de couleurs officielle de la couche
//    (format « GIBS Colormap ») : le calque travaille sur la mesure. Là où le satellite n'a rien mesuré (nuages,
//    nuit, neige, entre deux orbites), il n'y a aucune valeur ;
//  - PRÉVU : les poussières désertiques prévues par le modèle CAMS de Copernicus (service WMS public de l'ECMWF),
//    affichées telles que publiées, avec leur légende.

/** Service WMS de NASA GIBS en coordonnées géographiques (meilleure version disponible de chaque couche). */
// Déclare et exporte l'adresse du service WMS.
export const GIBS_WMS_4326 = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
/** Tables de couleurs de GIBS (spécification 1.3). */
// Déclare et exporte l'adresse des tables de couleurs.
export const GIBS_COLORMAPS = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3';
/** Description des couches WMTS de GIBS (pour trouver la table de couleurs d'une couche). */
// Déclare et exporte l'adresse de la description des couches.
export const GIBS_CAPABILITIES = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?request=GetCapabilities';
/** Taille de la grille mondiale (équirectangulaire) : 2 048 × 1 024 px, environ 20 km par pixel. */
// Déclare et exporte la taille de la grille.
export const AEROSOL_GRID = { width: 2048, height: 1024 };
/** Codage d'une valeur dans un octet : code = 1 + arrondi(valeur × 50), de 0 à 5,08 ; 0 = aucune mesure. */
// Déclare et exporte le facteur du codage.
export const AEROSOL_CODE_SCALE = 50;

/** Un produit observé : ses couches GIBS (par ordre de préférence), sa table de couleurs connue, son libellé. */
// Forme d'un produit.
export interface AerosolProduct {
  // id : l'identifiant du produit.
  id: 'aod' | 'ai';
  // layers : les couches GIBS, la première prioritaire là où les deux ont mesuré.
  layers: string[];
  // colormap : le nom connu de la table de couleurs, ou null (cherchée alors dans la description des couches).
  colormap: string | null;
  // title : le libellé.
  title: string;
  // provider : l'identifiant du fournisseur dans le registre.
  provider: string;
// Fin de AerosolProduct.
}

/** Produits observés. */
// Déclare et exporte les produits.
export const AEROSOL_PRODUCTS: AerosolProduct[] = [
  // Épaisseur optique des aérosols, VIIRS Deep Blue (terre et mer), NOAA-20 puis NOAA-21.
  { id: 'aod', layers: ['VIIRS_NOAA20_AOD_Deep_Blue_Land_Ocean', 'VIIRS_NOAA21_AOD_Deep_Blue_Land_Ocean'], colormap: null, title: 'Épaisseur optique des aérosols à 550 nm (VIIRS Deep Blue)', provider: 'gibs-viirs-aod' },
  // Indice d'aérosols absorbants à 380 nm, OMPS, NOAA-20 puis NOAA-21.
  { id: 'ai', layers: ['OMPS_NOAA20_NadirMapper_AerosolIndex_380', 'OMPS_NOAA21_NadirMapper_AerosolIndex_380'], colormap: 'OMPS_Aerosol_Index.xml', title: 'Indice d’aérosols absorbants à 380 nm (OMPS)', provider: 'gibs-omps-ai' },
// Fin des produits.
];

/** Adresse WMS d'une couche GIBS pour un jour, sur le monde entier, en PNG transparent. */
// Déclare et exporte gibsWmsUrl : la couche, le jour (AAAA-MM-JJ) et la taille.
export const gibsWmsUrl = (layer: string, date: string, width = AEROSOL_GRID.width, height = AEROSOL_GRID.height): string => `${GIBS_WMS_4326}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=${layer}&STYLES=&CRS=EPSG:4326&BBOX=-90,-180,90,180&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${date}`;

/** Jour UTC (AAAA-MM-JJ) d'un instant, décalé de `days` jours. */
// Déclare et exporte utcDay : l'instant (ms) et le décalage.
export const utcDay = (t: number, days = 0): string => new Date(t + days * 86_400_000).toISOString().slice(0, 10);

/** Une entrée d'une table de couleurs : couleur, valeur représentative (ou null : sans donnée). */
// Forme d'une entrée.
export interface ColormapEntry {
  // rgb : la couleur.
  rgb: [number, number, number];
  // value : la valeur représentative, ou null pour « sans donnée ».
  value: number | null;
// Fin de ColormapEntry.
}

/** Table de couleurs lue : titre, unité, entrées (valeurs), bornes de la légende. */
// Forme d'une table.
export interface Colormap {
  // title, units : le titre et l'unité de la table des valeurs.
  title: string; units: string;
  // entries : les couleurs porteuses d'une valeur.
  entries: ColormapEntry[];
  // min, max : les valeurs extrêmes.
  min: number; max: number;
// Fin de Colormap.
}

// attr : la valeur d'un attribut XML dans une balise, ou null.
const attr = (tag: string, name: string): string | null => {
  // Recherche de « nom="valeur" ».
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tag);
  // Valeur, ou null.
  return m ? m[1] : null;
// Fin de attr.
};

/** Valeur représentative d'un intervalle GIBS : « [a,b) » → milieu ; borne infinie → l'autre borne ; « [x] » → x. */
// Déclare et exporte rangeValue : le texte de l'intervalle.
export function rangeValue(text: string | null): number | null {
  // Absent : null.
  if (!text) return null;
  // Bornes, crochets et parenthèses retirés.
  const parts = text.replace(/[[\]()]/g, '').split(',').map((s) => s.trim());
  // Nombres finis.
  const nums = parts.map((p) => (/inf/i.test(p) ? NaN : Number(p))).filter(Number.isFinite);
  // Aucun : null ; un seul : lui ; deux : le milieu.
  return nums.length === 0 ? null : nums.length === 1 ? nums[0] : (nums[0] + nums[1]) / 2;
// Fin de rangeValue.
}

/**
 * Lit une table de couleurs GIBS (XML, spécification 1.3) : les entrées « transparent » ou « nodata » sont écartées ;
 * chaque autre couleur prend la valeur représentative de son intervalle (attribut value). Null si la table ne porte
 * aucune valeur (une table de classes sans valeurs ne peut pas être reconvertie en mesure).
 */
// Déclare et exporte parseGibsColormap : le texte XML.
export function parseGibsColormap(xml: string): Colormap | null {
  // Blocs ColorMap.
  const maps = [...xml.matchAll(/<ColorMap\b([^>]*)>([\s\S]*?)<\/ColorMap>/g)];
  // Pour chaque bloc, le premier qui porte des valeurs (début).
  for (const [, head, body] of maps) {
    // Entrées du bloc.
    const entries: ColormapEntry[] = [];
    // Balises ColorMapEntry.
    for (const [tag] of body.matchAll(/<ColorMapEntry\b[^>]*\/?>/g)) {
      // Transparente ou sans donnée : écartée.
      if (attr(tag, 'transparent') === 'true' || attr(tag, 'nodata') === 'true') continue;
      // Couleur.
      const rgb = (attr(tag, 'rgb') ?? '').split(',').map(Number);
      // Valeur représentative.
      const value = rangeValue(attr(tag, 'value'));
      // Couleur lisible et valeur connue : gardée.
      if (rgb.length === 3 && rgb.every((v) => Number.isInteger(v) && v >= 0 && v <= 255) && value !== null) entries.push({ rgb: rgb as [number, number, number], value });
    // Fin des entrées.
    }
    // Aucune valeur : bloc suivant.
    if (!entries.length) continue;
    // Valeurs extrêmes.
    const values = entries.map((e) => e.value as number);
    // Table lue.
    return { title: attr(head, 'title') ?? '', units: attr(head, 'units') ?? '', entries, min: Math.min(...values), max: Math.max(...values) };
  // Fin des blocs.
  }
  // Aucune valeur dans la table : null.
  return null;
// Fin de parseGibsColormap.
}

/** Adresse de la table de couleurs (version 1.3) d'une couche, trouvée dans la description WMTS de GIBS ; null sinon. */
// Déclare et exporte findColormapHref : la description XML et la couche.
export function findColormapHref(capabilities: string, layer: string): string | null {
  // Position de l'identifiant de la couche.
  const at = capabilities.indexOf(`<ows:Identifier>${layer}</ows:Identifier>`);
  // Absente : null.
  if (at < 0) return null;
  // Bloc de la couche : du début de sa balise Layer à sa fin.
  const start = capabilities.lastIndexOf('<Layer>', at), end = capabilities.indexOf('</Layer>', at);
  // Bloc illisible : null.
  if (start < 0 || end < 0) return null;
  // Adresse d'une table de couleurs 1.3 dans le bloc.
  const m = /xlink:href="(https:\/\/gibs\.earthdata\.nasa\.gov\/colormaps\/v1\.3\/[^"]+\.xml)"/.exec(capabilities.slice(start, end));
  // Adresse, ou null.
  return m ? m[1] : null;
// Fin de findColormapHref.
}

/** Index des couleurs d'une table : couleur exacte → valeur ; et recherche de la plus proche (écart ≤ 24). */
// Déclare et exporte colormapDecoder : la table.
export function colormapDecoder(cm: Colormap): (r: number, g: number, b: number) => number | null {
  // Index exact (pour une couleur répétée : la première).
  const exact = new Map<number, number>();
  // Remplissage.
  for (const e of cm.entries) { const k = (e.rgb[0] << 16) | (e.rgb[1] << 8) | e.rgb[2]; if (!exact.has(k)) exact.set(k, e.value as number); }
  // Couleurs déjà rapprochées.
  const near = new Map<number, number | null>();
  // Décodeur (début).
  return (r, g, b) => {
    // Clé de la couleur.
    const k = (r << 16) | (g << 8) | b;
    // Exacte : sa valeur.
    const v = exact.get(k);
    // Trouvée.
    if (v !== undefined) return v;
    // Déjà rapprochée.
    if (near.has(k)) return near.get(k) ?? null;
    // Plus proche couleur de la table.
    let best: number | null = null, bestD = Infinity;
    // Parcours.
    for (const e of cm.entries) { const d = Math.abs(e.rgb[0] - r) + Math.abs(e.rgb[1] - g) + Math.abs(e.rgb[2] - b); if (d < bestD) { bestD = d; best = e.value; } }
    // Assez proche : gardée ; sinon inconnue.
    const found = bestD <= 24 ? best : null;
    // Mémoire bornée.
    if (near.size > 8192) near.clear();
    // Gardée.
    near.set(k, found);
    // Valeur.
    return found;
  // Fin du décodeur.
  };
// Fin de colormapDecoder.
}

/** Code d'une valeur (voir AEROSOL_CODE_SCALE) ; les valeurs négatives (indice d'aérosols non absorbants) valent 1. */
// Déclare et exporte encodeAerosol : la valeur.
export const encodeAerosol = (v: number): number => Math.max(1, Math.min(255, 1 + Math.round(Math.max(0, v) * AEROSOL_CODE_SCALE)));
/** Valeur d'un code, ou null pour 0. */
// Déclare et exporte decodeAerosol : le code.
export const decodeAerosol = (code: number): number | null => (code > 0 ? (code - 1) / AEROSOL_CODE_SCALE : null);

/** Image décodée → codes par pixel (0 : aucune mesure) et nombre de pixels mesurés et de couleurs inconnues. */
// Déclare et exporte decodeAerosolImage : l'image et le décodeur.
export function decodeAerosolImage(img: DecodedPng, decode: (r: number, g: number, b: number) => number | null): { codes: Uint8Array; measured: number; unknown: number } {
  // Codes.
  const codes = new Uint8Array(img.width * img.height);
  // Bilan.
  let measured = 0, unknown = 0;
  // Pixel par pixel (début).
  for (let i = 0; i < codes.length; i++) {
    // Transparent : aucune mesure.
    if (img.rgba[i * 4 + 3] < 128) continue;
    // Valeur.
    const v = decode(img.rgba[i * 4], img.rgba[i * 4 + 1], img.rgba[i * 4 + 2]);
    // Inconnue : comptée, sans valeur.
    if (v === null) { unknown++; continue; }
    // Codée.
    codes[i] = encodeAerosol(v); measured++;
  // Fin des pixels.
  }
  // Résultat.
  return { codes, measured, unknown };
// Fin de decodeAerosolImage.
}

/** Réunit des grilles de codes : la première mesure présente l'emporte (ordre de préférence des satellites). */
// Déclare et exporte mergeCodes : les grilles.
export function mergeCodes(grids: Uint8Array[]): Uint8Array {
  // Grille de sortie, à la taille de la première.
  const out = new Uint8Array(grids[0]?.length ?? 0);
  // Pixel par pixel : première valeur non nulle.
  for (let i = 0; i < out.length; i++) for (const g of grids) if (g[i]) { out[i] = g[i]; break; }
  // Grille réunie.
  return out;
// Fin de mergeCodes.
}

/** Pixels RVB à envoyer au navigateur : rouge = mesure du jour, vert = mesure de la veille (codes), bleu = 0. */
// Déclare et exporte aerosolToRgb : les deux grilles.
export function aerosolToRgb(today: Uint8Array, yesterday: Uint8Array): Uint8Array {
  // Trois octets par pixel.
  const out = new Uint8Array(today.length * 3);
  // Pixel par pixel.
  for (let i = 0; i < today.length; i++) { out[i * 3] = today[i]; out[i * 3 + 1] = yesterday[i] ?? 0; }
  // Pixels.
  return out;
// Fin de aerosolToRgb.
}

/** Une zone de forte charge en aérosols. */
// Forme d'une zone.
export interface AerosolPlume {
  // lon, lat : le centre, pondéré par la valeur.
  lon: number; lat: number;
  // max, mean : la valeur maximale et moyenne.
  max: number; mean: number;
  // areaKm2 : la surface ; pixels : le nombre de pixels.
  areaKm2: number; pixels: number;
  // aiMax : l'indice d'aérosols absorbants maximal sur la zone, ou null s'il n'a pas été mesuré.
  aiMax: number | null;
  // fromYesterday : part des pixels mesurés la veille.
  fromYesterday: number;
  // bbox : ouest, sud, est, nord.
  bbox: [number, number, number, number];
// Fin de AerosolPlume.
}

/** Seuils des zones : AOD ≥ 0,6 pour la zone, noyau ≥ 1 ; au moins 6 pixels (environ 2 000 km²). */
// Déclare et exporte les seuils des zones.
export const PLUME = { edge: 0.6, core: 1.0, minPixels: 6, max: 300 };

/**
 * Zones de forte charge : régions connexes (8 voisins, refermées à l'antiméridien) où l'AOD réunie (jour, sinon
 * veille) atteint 0,6 avec un noyau d'au moins 1. `ai` (même grille, facultative) donne l'indice absorbant maximal.
 */
// Déclare et exporte detectPlumes : AOD du jour, de la veille, indice absorbant (jour puis veille), largeur, hauteur.
export function detectPlumes(today: Uint8Array, yesterday: Uint8Array, ai: Uint8Array | null, w: number, h: number): AerosolPlume[] {
  // Codes des seuils.
  const edge = encodeAerosol(PLUME.edge), core = encodeAerosol(PLUME.core);
  // code : la mesure du jour, sinon celle de la veille.
  const code = (i: number): number => today[i] || yesterday[i];
  // Pixels déjà rangés.
  const seen = new Uint8Array(w * h);
  // Zones trouvées.
  const plumes: AerosolPlume[] = [];
  // Côté d'un pixel en latitude, km.
  const dy = (Math.PI * EARTH_RADIUS_KM) / h, dxEq = (2 * Math.PI * EARTH_RADIUS_KM) / w;
  // Pile de parcours (indice et abscisse dépliée).
  const si: number[] = [], sx: number[] = [];
  // Pixel par pixel (début).
  for (let start = 0; start < w * h; start++) {
    // Déjà rangé ou sous le seuil : suivant.
    if (seen[start] || code(start) < edge) continue;
    // Départ.
    si.push(start); sx.push(start % w); seen[start] = 1;
    // Cumuls.
    let n = 0, nY = 0, wsum = 0, cx = 0, cy = 0, sum = 0, maxC = 0, area = 0, aiMax = 0, aiSeen = false, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // Parcours (début).
    while (si.length) {
      // Pixel et abscisse dépliée.
      const i = si.pop() as number, ux = sx.pop() as number;
      // Ligne.
      const y = (i / w) | 0;
      // Code et valeur.
      const c = code(i), v = (c - 1) / AEROSOL_CODE_SCALE;
      // Cumuls (le poids est la valeur).
      n++; if (!today[i]) nY++; wsum += v; cx += v * (ux + 0.5); cy += v * (y + 0.5); sum += v; if (c > maxC) maxC = c;
      // Surface du pixel.
      area += dy * dxEq * Math.cos(((90 - ((y + 0.5) * 180) / h) * Math.PI) / 180);
      // Indice absorbant.
      if (ai && ai[i]) { aiSeen = true; aiMax = Math.max(aiMax, (ai[i] - 1) / AEROSOL_CODE_SCALE); }
      // Bornes.
      if (ux < minX) minX = ux; if (ux > maxX) maxX = ux; if (y < minY) minY = y; if (y > maxY) maxY = y;
      // Voisins (début).
      for (let ddy = -1; ddy <= 1; ddy++) for (let ddx = -1; ddx <= 1; ddx++) {
        // Lui-même : ignoré.
        if (!ddx && !ddy) continue;
        // Ligne voisine hors de la grille : ignorée.
        const ny = y + ddy; if (ny < 0 || ny >= h) continue;
        // Abscisse voisine dépliée et ramenée (grille refermée).
        const nux = ux + ddx, nx = ((nux % w) + w) % w;
        // Indice voisin.
        const j = ny * w + nx;
        // Déjà rangé ou sous le seuil : ignoré.
        if (seen[j] || code(j) < edge) continue;
        // Marqué et empilé.
        seen[j] = 1; si.push(j); sx.push(nux);
      // Fin des voisins.
      }
    // Fin du parcours.
    }
    // Sans noyau ou trop petite : écartée.
    if (maxC < core || n < PLUME.minPixels) continue;
    // lonOf, latOf : coordonnées d'une abscisse dépliée et d'une ordonnée de pixel.
    const lonOf = (x: number): number => ((((x / w) * 360 - 180) + 540) % 360) - 180, latOf = (y: number): number => 90 - (y * 180) / h;
    // r : arrondi au millième.
    const r = (v: number): number => Math.round(v * 1000) / 1000;
    // Zone gardée.
    plumes.push({ lon: r(lonOf(cx / wsum)), lat: r(latOf(cy / wsum)), max: r((maxC - 1) / AEROSOL_CODE_SCALE), mean: Math.round((sum / n) * 100) / 100, areaKm2: Math.round(area), pixels: n, aiMax: aiSeen ? Math.round(aiMax * 100) / 100 : null, fromYesterday: Math.round((nY / n) * 100) / 100, bbox: [r(lonOf(minX)), r(latOf(maxY + 1)), r(lonOf(maxX + 1)), r(latOf(minY))] });
  // Fin de la recherche.
  }
  // Les plus fortes, puis les plus étendues ; coupées à la limite.
  return plumes.sort((a, b) => b.max - a.max || b.areaKm2 - a.areaKm2).slice(0, PLUME.max);
// Fin de detectPlumes.
}

/** Nature probable d'une zone : absorbante (poussières ou fumées) si l'indice OMPS atteint 1,5 ; sinon inconnue. */
// Déclare et exporte plumeNature : la zone.
export const plumeNature = (p: AerosolPlume): string => (p.aiMax === null ? 'nature non mesurée (indice absorbant absent)' : p.aiMax >= 1.5 ? 'aérosols absorbants : poussières ou fumées' : 'aérosols peu absorbants : pollution, brume ou sel marin');

/** Zone → événement « aerosol » au format commun : la charge est observée, sa nature est estimée. */
// Déclare et exporte plumeToEvent : la zone, le jour observé (AAAA-MM-JJ) et l'heure de lecture.
export function plumeToEvent(p: AerosolPlume, day: string, fetchedAt: string): AtmosphericEvent {
  // Heure de référence : midi UTC du jour observé (produit quotidien, passages de jour).
  const at = `${day}T12:00:00.000Z`;
  // Événement (début).
  return {
    // Identifiant, famille, sans nom.
    id: makeEventId('aerosol', 'gibs', `${day}:${p.lon.toFixed(1)},${p.lat.toFixed(1)}`), type: 'aerosol', name: null,
    // Centre et emprise.
    lon: p.lon, lat: p.lat, geometry: { type: 'Polygon', coordinates: [[[p.bbox[0], p.bbox[1]], [p.bbox[2], p.bbox[1]], [p.bbox[2], p.bbox[3]], [p.bbox[0], p.bbox[3]], [p.bbox[0], p.bbox[1]]]] },
    // Altitude : la colonne entière (l'AOD ne dit pas l'altitude).
    altitudeM: null,
    // Heures : le jour observé.
    detectedAt: at, validFrom: `${day}T00:00:00.000Z`, validTo: `${day}T23:59:59.000Z`,
    // Intensité : AOD maximale.
    intensity: { value: p.max, unit: 'AOD 550 nm', label: p.max >= 2 ? 'charge très forte' : p.max >= 1.5 ? 'charge forte' : 'charge élevée' },
    // Confiance : mesure satellite, un peu moins si la zone vient surtout de la veille.
    confidence: p.fromYesterday > 0.5 ? 0.7 : 0.8,
    // Provenance.
    sources: [{ provider: 'gibs-viirs-aod', sourceId: day, url: null, observedAt: at, fetchedAt }, ...(p.aiMax !== null ? [{ provider: 'gibs-omps-ai', sourceId: day, url: null, observedAt: at, fetchedAt }] : [])],
    // Résolution : la grille (environ 20 km), un jour.
    resolution: { spatialM: 19_500, temporalS: 86_400 },
    // Charge observée ; nature estimée (drapeau).
    status: 'observé', confirmed: true, flags: [`nature estimée : ${plumeNature(p)}`, ...(p.fromYesterday > 0.5 ? ['mesurée surtout la veille'] : [])],
    // Détails.
    details: { aodMean: p.mean, areaKm2: p.areaKm2, aiMax: p.aiMax, nature: plumeNature(p), natureStatus: 'estimé', fromYesterday: p.fromYesterday, method: `zone d’AOD ≥ ${PLUME.edge} avec un noyau ≥ ${PLUME.core} (VIIRS Deep Blue, jour puis veille)` },
  // Fin de l'événement.
  };
// Fin de plumeToEvent.
}

/** Couche CAMS des poussières (épaisseur optique des poussières à 550 nm), service WMS public de l'ECMWF. */
// Déclare et exporte la couche CAMS.
export const CAMS_DUST_LAYER = 'composition_duaod550';
/** Service WMS public de l'ECMWF (jeton « public »). */
// Déclare et exporte l'adresse du service.
export const CAMS_WMS = 'https://eccharts.ecmwf.int/wms/?token=public';
/** Prévision affichée : toutes les 6 heures sur 48 heures (9 images). */
// Déclare et exporte le pas et la portée de la prévision.
export const CAMS_STEP_H = 6, CAMS_RANGE_H = 48;

/** Heures de validité de la prévision affichée, à partir du créneau de 6 h en cours (ISO, à la seconde). */
// Déclare et exporte camsTimes : l'instant de référence.
export function camsTimes(now: number): string[] {
  // Créneau en cours.
  const t0 = Math.floor(now / (CAMS_STEP_H * 3_600_000)) * CAMS_STEP_H * 3_600_000;
  // Une heure par pas, jusqu'à la portée.
  return Array.from({ length: CAMS_RANGE_H / CAMS_STEP_H + 1 }, (_, k) => new Date(t0 + k * CAMS_STEP_H * 3_600_000).toISOString().replace('.000Z', 'Z'));
// Fin de camsTimes.
}

/** Adresse d'une image CAMS du monde entier (1 024 × 512, équirectangulaire, transparente) à une heure de validité. */
// Déclare et exporte camsMapUrl : l'heure de validité (ISO) et la couche.
export const camsMapUrl = (time: string, layer = CAMS_DUST_LAYER): string => `${CAMS_WMS}&service=WMS&version=1.3.0&request=GetMap&layers=${layer}&styles=&crs=EPSG:4326&bbox=-90,-180,90,180&width=1024&height=512&format=image/png&transparent=true&time=${encodeURIComponent(time)}`;
/** Adresse de la légende d'une couche CAMS. */
// Déclare et exporte camsLegendUrl : la couche.
export const camsLegendUrl = (layer = CAMS_DUST_LAYER): string => `${CAMS_WMS}&service=WMS&version=1.3.0&request=GetLegendGraphic&layer=${layer}&format=image/png`;
