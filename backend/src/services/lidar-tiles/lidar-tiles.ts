/**
 * Nuages de points LiDAR HD de l'IGN, lus en direct sur la Géoplateforme et affichés en vrais points 3D : fonctions
 * pures (testées dans lidar-tiles.spec.ts).
 *
 * Source : le jeu IGNF_NUAGES-DE-POINTS-LIDAR-HD (catalogue https://data.geopf.fr/catalog). Toute la France est
 * découpée en dalles de 1 km × 1 km, diffusées en COPC (LAZ 1.4 indexé en octree). La couche WFS
 * IGNF_LIDAR-HD_METADONNEE:metadata donne, pour chaque dalle, l'adresse de son nuage (`url_npl`). Le serveur lit
 * l'en-tête et la hiérarchie COPC par requêtes partielles (HTTP Range), puis, à la demande, le bloc LAZ d'un seul nœud,
 * qu'il décode (tools/lidar/lazdec) et convertit au format compact envoyé au navigateur.
 *
 * Fichier d'un nœud, compressé en gzip (servi avec Content-Encoding : le navigateur le décompresse) — n points,
 * 8 octets par point rangés par plans : écarts de X (octets bas, puis octets hauts), écarts de Y, écarts de Z, classe
 * d'affichage, luminosité. X et Y sont comptés depuis le coin du nœud, Z depuis le bas du cube COPC, en pas de `step`
 * mètres ; chaque écart (différence avec le point précédent) est codé en zigzag sur 16 bits. La luminosité (170 =
 * neutre) vient de l'intensité du retour laser.
 */

// Réexporte ByteCache, le cache mémoire borné en octets, depuis common.
export { ByteCache } from '../../common/byte-cache';

/** Classes d'affichage (octet « classe » d'un point). */
// Noms des dix classes d'affichage d'un point, dans l'ordre de leur numéro (0 à 9).
export const LIDAR_CLASSES = ['divers', 'sol', 'végétation basse', 'végétation moyenne', 'végétation haute', 'toit', 'façade', 'eau', 'pont', 'sursol'] as const;
/** Pas de quantification des coordonnées envoyées au navigateur (m) : 4 cm. */
// Déclare et exporte le pas : 0,04 m.
export const LIDAR_STEP = 0.04;
/** Classes ASPRS écartées : bruit, artefacts, points virtuels. */
// Déclare et exporte les classes écartées : 7, 65, 66.
export const DROPPED_CLASSES = new Set([7, 65, 66]);
/** Adresse du service WFS de la Géoplateforme. */
// Déclare et exporte l'adresse du WFS.
export const IGN_WFS_URL = 'https://data.geopf.fr/wfs/ows';
/** Couche WFS des métadonnées des dalles LiDAR HD (une entité par dalle, avec l'adresse de son nuage `url_npl`). */
// Déclare et exporte le nom de la couche, remplaçable par la variable d'environnement LIDAR_IGN_WFS_LAYER.
export const IGN_LIDAR_LAYER = 'IGNF_LIDAR-HD_METADONNEE:metadata';
/** Taille d'une entrée de la hiérarchie COPC (octets). */
// Déclare la taille d'une entrée : 32 octets.
const ENTRY_BYTES = 32;
/** Taille d'un point décodé par lazdec (octets) : X, Y, Z (entiers 32 bits), intensité (16 bits), classe, niveau. */
// Déclare et exporte la taille d'un point décodé : 16 octets.
export const LAZDEC_POINT_BYTES = 16;
/** Octets à lire au début du fichier : en-tête LAS 1.4 (375) + en-tête du VLR « copc info » (54) + son contenu (160). */
// Déclare et exporte la longueur de l'en-tête à lire : 589 octets.
export const COPC_HEADER_BYTES = 589;

/** Forme d'un identifiant de dalle : 2 à 61 caractères (minuscules, chiffres, tirets), sans tiret au début. */
// Expression de l'identifiant.
const TILE_ID = /^[a-z0-9][a-z0-9-]{1,60}$/;
/** Forme d'une clé de nœud : quatre nombres séparés par des tirets, niveau puis x, y, z. */
// Expression de la clé.
const NODE_KEY = /^(\d{1,2})-(\d{1,5})-(\d{1,5})-(\d{1,5})$/;
// Fonction isLidarTileId : la valeur est-elle un texte de la bonne forme ?
export const isLidarTileId = (id: unknown): id is string => typeof id === 'string' && TILE_ID.test(id);
/** Clé de nœud bien formée : niveau ≤ 12 et indices dans la grille du niveau. */
// Fonction isLidarNodeKey : la clé est-elle valable ?
export function isLidarNodeKey(key: unknown): key is string {
  // Reconnaît la clé si c'est un texte ; null sinon.
  const m = typeof key === 'string' ? NODE_KEY.exec(key) : null;
  // Forme incorrecte : non.
  if (!m) return false;
  // Niveau.
  const level = Number(m[1]);
  // Au-delà du niveau 12 : non.
  if (level > 12) return false;
  // Nombre de cases par axe à ce niveau.
  const size = 2 ** level;
  // Oui si x, y et z tiennent dans cette grille.
  return Number(m[2]) < size && Number(m[3]) < size && Number(m[4]) < size;
// Fin de isLidarNodeKey.
}

/**
 * Identifiant d'une dalle d'après l'adresse de son nuage : « …/LHD_FXX_0652_6863_PTS_… .copc.laz » → « lhd-0652-6863 »
 * (bord ouest et bord nord, en kilomètres Lambert-93). Null si l'adresse ne porte pas ce nom.
 */
// Fonction tileIdFromUrl : l'adresse du nuage.
export function tileIdFromUrl(url: unknown): string | null {
  // Cherche le nom de dalle de l'IGN dans l'adresse.
  const m = typeof url === 'string' ? /LHD_[A-Z]{3}_(\d{4})_(\d{4})/.exec(url) : null;
  // Trouvé : identifiant en minuscules ; sinon null.
  return m ? `lhd-${m[1]}-${m[2]}` : null;
// Fin de tileIdFromUrl.
}

/** Bord ouest et bord nord (km Lambert-93) d'une dalle d'après son identifiant, ou null. */
// Fonction tileKmFromId : l'identifiant.
export function tileKmFromId(id: string): { x: number; y: number } | null {
  // Forme « lhd-XXXX-YYYY ».
  const m = /^lhd-(\d{4})-(\d{4})$/.exec(id);
  // Trouvé : les deux nombres ; sinon null.
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
// Fin de tileKmFromId.
}

/**
 * Adresse WFS des dalles autour d'un point (degrés), sur un carré de `radiusM` mètres de demi-côté, en GeoJSON. L'emprise
 * est donnée latitude d'abord, avec le nom complet du système (EPSG:4326), comme les autres requêtes de l'IGN de l'app.
 */
// Fonction lidarWfsUrl : la longitude, la latitude, la demi-largeur en mètres, la couche et le nombre maximal.
export function lidarWfsUrl(lon: number, lat: number, radiusM = 600, layer = IGN_LIDAR_LAYER, count = 9): string {
  // Demi-largeur en degrés de latitude, puis de longitude.
  const dLat = radiusM / 111_195, dLon = dLat / Math.max(0.1, Math.cos(lat * (Math.PI / 180)));
  // Paramètres de la requête.
  const q = new URLSearchParams({
    // Service, version et requête.
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature',
    // Couche, format et système.
    TYPENAMES: layer, OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326',
    // Emprise, latitude d'abord, et nombre maximal de dalles.
    BBOX: `${lat - dLat},${lon - dLon},${lat + dLat},${lon + dLon},urn:ogc:def:crs:EPSG::4326`, COUNT: String(count),
  // Fin des paramètres.
  });
  // Renvoie l'adresse.
  return `${IGN_WFS_URL}?${q}`;
// Fin de lidarWfsUrl.
}

/** Une dalle trouvée dans le WFS : identifiant, adresse du nuage, nombre de points annoncé, date du relevé. */
export interface IgnLidarTile { id: string; url: string; points: number | null; acquired: string | null }

/** Dalles lues dans une réponse GeoJSON du WFS : celles qui ont une adresse de nuage COPC utilisable, sans doublon. */
// Fonction tilesFromWfs : la réponse JSON.
export function tilesFromWfs(json: unknown): IgnLidarTile[] {
  // Entités de la réponse, ou aucune.
  const features = Array.isArray((json as { features?: unknown[] })?.features) ? (json as { features: unknown[] }).features : [];
  // Dalles retenues, par identifiant.
  const out = new Map<string, IgnLidarTile>();
  // Pour chaque entité (début).
  for (const f of features) {
    // Ses attributs.
    const p = ((f as { properties?: Record<string, unknown> })?.properties ?? {}) as Record<string, unknown>;
    // Adresse du nuage de points.
    const url = typeof p.url_npl === 'string' ? p.url_npl.trim() : '';
    // Seulement une adresse https vers un fichier LAZ.
    if (!/^https:\/\//i.test(url) || !/\.laz(\?|$)/i.test(url)) continue;
    // Identifiant de la dalle.
    const id = tileIdFromUrl(url);
    // Sans identifiant, ou déjà vue : suivante.
    if (!id || out.has(id)) continue;
    // Nombre de points annoncé.
    const points = typeof p.nombre_points === 'number' && p.nombre_points > 0 ? p.nombre_points : null;
    // Date de fin du relevé.
    const acquired = typeof p.date_fin_acquisition === 'string' ? p.date_fin_acquisition.slice(0, 10) : null;
    // Retenue.
    out.set(id, { id, url, points, acquired });
  // Fin des entités.
  }
  // Renvoie les dalles.
  return [...out.values()];
// Fin de tilesFromWfs.
}

/** Informations de l'en-tête LAS 1.4 et du VLR « copc info ». */
export interface CopcInfo {
  // Format de point, échelle et décalage des coordonnées.
  pointFormat: number; scale: [number, number, number]; offset: [number, number, number];
  // Altitudes minimale et maximale des points (m).
  minZ: number; maxZ: number;
  // Centre et demi-côté du cube racine (m), écart des points de la racine (m).
  cx: number; cy: number; cz: number; half: number; spacing: number;
  // Position et taille de la première page de la hiérarchie.
  rootOffset: number; rootSize: number;
}

/** Lit l'en-tête LAS 1.4 et le VLR « copc info » (589 premiers octets). Lève une erreur si ce n'est pas un COPC. */
// Fonction parseCopcHeader : les premiers octets du fichier.
export function parseCopcHeader(buf: Buffer): CopcInfo {
  // Trop court : erreur.
  if (buf.length < COPC_HEADER_BYTES) throw new Error('En-tête COPC incomplet.');
  // Signature LAS et version 1.4.
  if (buf.toString('latin1', 0, 4) !== 'LASF' || buf[24] !== 1 || buf[25] !== 4) throw new Error('Fichier LAS 1.4 attendu.');
  // Premier VLR « copc ».
  if (buf.toString('latin1', 377, 381) !== 'copc') throw new Error('VLR « copc info » attendu en premier.');
  // Lecture d'un double à une position.
  const d = (o: number) => buf.readDoubleLE(o);
  // Renvoie les informations (début).
  return {
    // Format de point (6 bits bas), échelle et décalage.
    pointFormat: buf[104] & 0x3f, scale: [d(131), d(139), d(147)], offset: [d(155), d(163), d(171)],
    // Altitudes maximale (211) et minimale (219).
    maxZ: d(211), minZ: d(219),
    // Cube racine et écart des points.
    cx: d(429), cy: d(437), cz: d(445), half: d(453), spacing: d(461),
    // Première page de la hiérarchie.
    rootOffset: Number(buf.readBigUInt64LE(469)), rootSize: Number(buf.readBigUInt64LE(477)),
  // Fin des informations.
  };
// Fin de parseCopcHeader.
}

/** Une entrée de la hiérarchie COPC : nœud (count ≥ 0) ou page à lire (count = −1). */
export interface CopcEntry { key: string; level: number; x: number; y: number; z: number; offset: number; size: number; count: number }

/** Lit une page de la hiérarchie COPC : 32 octets par entrée. */
// Fonction parseHierarchyPage : les octets de la page.
export function parseHierarchyPage(buf: Buffer): CopcEntry[] {
  // Entrées lues.
  const out: CopcEntry[] = [];
  // Pour chaque entrée complète (début).
  for (let o = 0; o + ENTRY_BYTES <= buf.length; o += ENTRY_BYTES) {
    // Niveau et place dans l'octree.
    const level = buf.readInt32LE(o), x = buf.readInt32LE(o + 4), y = buf.readInt32LE(o + 8), z = buf.readInt32LE(o + 12);
    // Position et taille du bloc (ou de la page), nombre de points (−1 : page).
    const offset = Number(buf.readBigUInt64LE(o + 16)), size = buf.readInt32LE(o + 24), count = buf.readInt32LE(o + 28);
    // Ajoute l'entrée.
    out.push({ key: `${level}-${x}-${y}-${z}`, level, x, y, z, offset, size, count });
  // Fin des entrées.
  }
  // Renvoie les entrées.
  return out;
// Fin de parseHierarchyPage.
}

/** Classe d'affichage d'une classe ASPRS (le bâti est trié ensuite entre toit et façade). */
// Fonction displayClass : la classe ASPRS.
export function displayClass(c: number): number {
  // Sol, végétation basse, moyenne et haute, eau, pont, sursol pérenne ; bâti (6, 67) : toit par défaut ; sinon divers.
  switch (c) { case 2: return 1; case 3: return 2; case 4: return 3; case 5: return 4; case 9: return 7; case 17: return 8; case 64: return 9; case 6: case 67: return 5; default: return 0; }
// Fin de displayClass.
}

/** Luminosité d'un point (170 = neutre) d'après l'intensité de son retour laser. */
// Fonction luminosity : l'intensité brute.
export function luminosity(intensity: number): number {
  // Intensité ramenée entre 0,25 et 1,12.
  const i = Math.min(1.12, Math.max(0.25, Math.sqrt(intensity / 2200)));
  // Luminosité sur un octet.
  return Math.max(0, Math.min(255, Math.round((0.48 + 0.52 * i) * 170)));
// Fin de luminosity.
}

/** Paramètres de la conversion d'un nœud : échelle et décalage du fichier, coin du nœud et bas du cube (m), pas (m). */
export interface NodeFrame { scale: [number, number, number]; offset: [number, number, number]; minX: number; minY: number; z0: number; step: number }

/**
 * Convertit les points décodés d'un nœud (16 octets par point, sortie de lazdec) au format envoyé au navigateur
 * (8 octets par point rangés par plans, non compressé). Écarte le bruit et les points virtuels ; sépare le bâti en toit
 * (au sommet de sa cellule de 1 m, à 75 cm près) et façade. Renvoie les octets et le nombre de points gardés.
 */
// Fonction encodeNode : les points décodés et le repère du nœud.
export function encodeNode(raw: Buffer, f: NodeFrame): { bytes: Buffer; count: number } {
  // Nombre de points décodés.
  const total = Math.floor(raw.length / LAZDEC_POINT_BYTES);
  // Coordonnées quantifiées, classes et luminosités des points gardés.
  const qx: number[] = [], qy: number[] = [], qz: number[] = [], cls: number[] = [], lum: number[] = [];
  // Altitude maximale du bâti par cellule de 1 m, et cellule de chaque point du bâti.
  const top = new Map<number, number>(), builtCell: (number | null)[] = [];
  // Borne : 32 767 pas.
  const clamp = (v: number) => Math.max(0, Math.min(32767, v));
  // Pour chaque point décodé (début).
  for (let i = 0; i < total; i++) {
    // Position de ses octets.
    const o = i * LAZDEC_POINT_BYTES;
    // Sa classe ASPRS.
    const c = raw[o + 14];
    // Bruit, artefact ou point virtuel : écarté.
    if (DROPPED_CLASSES.has(c)) continue;
    // Coordonnées en mètres.
    const x = raw.readInt32LE(o) * f.scale[0] + f.offset[0], y = raw.readInt32LE(o + 4) * f.scale[1] + f.offset[1], z = raw.readInt32LE(o + 8) * f.scale[2] + f.offset[2];
    // Quantifiées en pas, depuis le coin du nœud et le bas du cube.
    qx.push(clamp(Math.floor((x - f.minX) / f.step))); qy.push(clamp(Math.floor((y - f.minY) / f.step))); qz.push(clamp(Math.floor((z - f.z0) / f.step)));
    // Classe d'affichage et luminosité.
    const k = displayClass(c); cls.push(k); lum.push(luminosity(raw.readUInt16LE(o + 12)));
    // Bâti : note sa cellule de 1 m et l'altitude maximale de la cellule.
    if (k === 5) { const cell = Math.floor(x - f.minX) * 4096 + Math.floor(y - f.minY); builtCell.push(cell); top.set(cell, Math.max(top.get(cell) ?? -Infinity, z)); } else builtCell.push(null);
  // Fin des points.
  }
  // Nombre de points gardés.
  const n = qx.length;
  // Bâti sous le sommet de sa cellule (plus de 75 cm) : façade.
  for (let i = 0; i < n; i++) { const cell = builtCell[i]; if (cell !== null && qz[i] * f.step + f.z0 < (top.get(cell) ?? Infinity) - 0.75) cls[i] = 6; }
  // Tampon de sortie : 8 octets par point.
  const out = Buffer.alloc(8 * n);
  // Écrit un axe : écarts en zigzag sur 16 bits, plan des octets bas puis plan des octets hauts.
  const plane = (v: number[], at: number) => { let prev = 0; for (let i = 0; i < n; i++) { const dlt = v[i] - prev; prev = v[i]; const u = ((dlt << 1) ^ (dlt >> 31)) & 0xffff; out[at + i] = u & 255; out[at + n + i] = u >> 8; } };
  // X, Y et Z.
  plane(qx, 0); plane(qy, 2 * n); plane(qz, 4 * n);
  // Classes, puis luminosités.
  for (let i = 0; i < n; i++) { out[6 * n + i] = cls[i]; out[7 * n + i] = lum[i]; }
  // Renvoie les octets et le nombre de points.
  return { bytes: out, count: n };
// Fin de encodeNode.
}

/**
 * Orthophoto drapée sur les points (colorisation) : le relevé laser n'a pas de couleur, chaque point prend celle de la
 * photo aérienne de l'IGN à sa verticale. Tuiles WMTS de la Géoplateforme (Web Mercator, JPEG, sans clé), chargées
 * directement par le navigateur comme le fond de carte.
 */
// Orthophoto à draper sur les points :
export const LIDAR_IMAGERY = {
  // modèle d'adresse des tuiles de l'IGN, première moitié ;
  template: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal'
    // seconde moitié, avec les trous {z}, {y}, {x} ;
    + '&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',
  // niveau de zoom maximal ;
  maxZoom: 19,
  // mention à afficher.
  attribution: 'Orthophotos © IGN — Géoplateforme (Licence Ouverte 2.0)',
// Fin de LIDAR_IMAGERY.
};
