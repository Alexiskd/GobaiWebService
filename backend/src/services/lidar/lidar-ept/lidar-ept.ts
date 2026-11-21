/**
 * Nuages de points LiDAR HD de l'IGN, servis en Entwine Point Tiles (EPT) : fonctions pures (testées dans
 * lidar-ept.spec.ts). C'est la méthodologie de la visionneuse officielle de l'IGN (visionneuse-lidarhd.ign.fr) :
 *
 *  - un index de dalles « index.vpc » (une entrée par dalle EPT, avec son emprise en Lambert-93 et l'adresse de son
 *    manifeste `ept.json`), lu une fois puis gardé en mémoire ;
 *  - par dalle EPT : `ept.json` (cube racine, pas de la grille, échelle et décalage des coordonnées), puis la
 *    hiérarchie de l'octree `ept-hierarchy/<clé>.json` (clé « niveau-x-y-z », nombre de points du nœud ; −1 : la
 *    suite de l'arbre est dans le fichier de cette clé) ;
 *  - par nœud : son nuage `ept-data/<clé>.laz` (LAZ 1.4, format de point 6), décodé par tools/lidar/lazdec.
 *
 * Le navigateur, lui, reçoit des « dalles » de 781 m (les cellules de niveau 6 de l'octree EPT, environ la taille
 * des dalles COPC d'un kilomètre) : chaque cellule devient un manifeste racine du format du LidarEngine, dont les
 * nœuds sont renumérotés depuis son niveau (rekeyToTile), le décodage et la compression gzip restant ceux du service.
 * Sur 781 m posés à plat sur la sphère, l'écart avec la courbure de la Terre reste sous 3 cm.
 */

/** Adresse de l'index des dalles EPT du LiDAR HD (remplaçable par la variable d'environnement LIDAR_IGN_EPT_VPC). */
// Déclare et exporte l'adresse de l'index EPT.
export const IGN_EPT_VPC_URL = 'https://data.geopf.fr/chunk/telechargement/download/lidarhd_fxx_ept/vpc-128/index.vpc';
/** Profondeur de l'octree EPT des dalles servies au navigateur (niveau 6 : cellules d'environ 781 m de côté). */
// Déclare et exporte la profondeur des dalles : 6.
export const EPT_TILE_DEPTH = 6;
/** Empreinte de version des nœuds EPT servis : change l'adresse (cache des navigateurs) si la conversion change. */
// Déclare et exporte la version « ept1 ».
export const EPT_NODE_VERSION = 'ept1';
/** Niveau EPT le plus profond attendu (laszip fin) : 13, comme la limite des clés du LidarEngine. */
// Déclare et exporte la profondeur maximale de l'octree : 13.
export const EPT_MAX_DEPTH = 13;

/** Emprise d'une dalle EPT en Lambert-93 : [X ouest, Y sud, Z bas, X est, Y nord, Z haut] (m). */
export type EptBbox = [number, number, number, number, number, number];

/** Une dalle EPT de l'index : identifiant court, adresse de son ept.json (et de sa base), emprise Lambert-93, points annoncés. */
export interface EptDalle { id: string; code: string; eptUrl: string; base: string; bbox: EptBbox; points: number | null }

/** Le ept.json d'une dalle : cube racine, emprise réelle des points, écart de la grille, échelle et décalage des coordonnées. */
export interface EptInfo {
  // Cube racine (m Lambert-93) et emprise réelle des points (m).
  bounds: EptBbox; conforming: EptBbox;
  // Écart de la grille (le côté du cube divisé par 2 puissance la profondeur des feuilles) et points annoncés.
  span: number; points: number;
  // Échelle et décalage des coordonnées X, Y et Z (entrées du schéma).
  scale: [number, number, number]; offset: [number, number, number];
// Fin de EptInfo.
}

/** Une entrée de la hiérarchie EPT : clé « niveau-x-y-z » et son nombre de points (−1 : la suite est dans le fichier de cette clé). */
export interface EptEntry { key: string; level: number; x: number; y: number; z: number; count: number }

/** Clé « niveau-x-y-z » décomposée, ou null. */
// Fonction parseEptKey : la clé.
export function parseEptKey(key: string): { level: number; x: number; y: number; z: number } | null {
  // Les quatre nombres de la clé.
  const m = /^(\d{1,2})-(\d{1,5})-(\d{1,5})-(\d{1,5})$/.exec(key);
  // Illisible : null.
  if (!m) return null;
  // Renvoie le niveau et les indices.
  return { level: Number(m[1]), x: Number(m[2]), y: Number(m[3]), z: Number(m[4]) };
// Fin de parseEptKey.
}

/**
 * Identifiant d'une dalle EPT dans l'index : son adresse « …/lidarhd_fxx_ept/KE_EPT/ept.json » donne « ept-ke »
 * (les 168 dalles de l'index suivent toutes la forme « XX_EPT »).
 */
// Fonction eptDalleId : l'adresse du ept.json.
export function eptDalleId(eptUrl: string): string | null {
  // Le dossier de la dalle, avant ept.json.
  const m = /\/([A-Z]{2})_EPT\/ept\.json$/.exec(eptUrl);
  // Sans dossier : null.
  if (!m) return null;
  // Identifiant court en minuscules.
  return `ept-${m[1].toLowerCase()}`;
// Fin de eptDalleId.
}

/** Adresse de la base d'une dalle (tout ce qui précède « /ept.json ») : hiérarchie et nœuds y sont rangés. */
// Fonction eptBase : l'adresse du ept.json.
export const eptBase = (eptUrl: string): string => eptUrl.replace(/\/ept\.json$/, '');

/** Adresse d'une page de la hiérarchie d'une dalle. */
// Déclare et exporte eptHierarchyUrl : la base et la clé.
export const eptHierarchyUrl = (base: string, key: string): string => `${base}/ept-hierarchy/${key}.json`;

/** Adresse du nuage d'un nœud (LAZ 1.4, format de point 6). */
// Déclare et exporte eptDataUrl : la base et la clé.
export const eptDataUrl = (base: string, key: string): string => `${base}/ept-data/${key}.laz`;

/**
 * Dalles lues dans l'index (index.vpc, GeoJSON) : une entité par dalle, avec son emprise Lambert-93
 * (« proj:bbox »), ses points annoncés (« pc:count ») et l'adresse de son ept.json (`assets.data.href`).
 */
// Fonction parseVpc : la réponse JSON de l'index.
export function parseVpc(json: unknown): EptDalle[] {
  // Entités de l'index, ou aucune.
  const features = Array.isArray((json as { features?: unknown[] })?.features) ? (json as { features: unknown[] }).features : [];
  // Dalles retenues, par identifiant (l'index n'a pas de doublon, mais par sécurité).
  const out = new Map<string, EptDalle>();
  // Pour chaque entité (début).
  for (const f of features) {
    // Ses attributs et son adresse.
    const p = ((f as { properties?: Record<string, unknown> })?.properties ?? {}) as Record<string, unknown>;
    const href = ((f as { assets?: { data?: { href?: unknown } } })?.assets?.data?.href) as unknown;
    // Adresse du ept.json.
    const eptUrl = typeof href === 'string' && /\.json$/.test(href) ? href : '';
    // Identifiant de la dalle.
    const id = eptDalleId(eptUrl);
    // Sans identifiant ou déjà vue : suivante.
    if (!id || out.has(id)) continue;
    // Emprise Lambert-93 de la dalle.
    const raw = p['proj:bbox'];
    const bbox = Array.isArray(raw) && raw.length === 6 && raw.every((v) => typeof v === 'number') ? (raw as EptBbox) : null;
    // Sans emprise : suivante.
    if (!bbox) continue;
    // Retenue, avec ses points annoncés.
    out.set(id, { id, code: id.slice(4), eptUrl, base: eptBase(eptUrl), bbox, points: typeof p['pc:count'] === 'number' ? p['pc:count'] : null });
  // Fin des entités.
  }
  // Renvoie les dalles.
  return [...out.values()];
// Fin de parseVpc.
}

/** Le ept.json d'une dalle : cube racine, emprise réelle, écart de la grille, points, échelle et décalage. */
// Fonction parseEptInfo : le ept.json.
export function parseEptInfo(json: unknown): EptInfo {
  // Le fichier.
  const j = json as Record<string, unknown>;
  // Six nombres : le cube racine, puis l'emprise réelle des points.
  const box = (v: unknown): EptBbox | null => (Array.isArray(v) && v.length === 6 && v.every((n) => typeof n === 'number') ? (v as EptBbox) : null);
  const bounds = box(j.bounds), conforming = box(j.boundsConforming) ?? bounds;
  // Sans cube : erreur.
  if (!bounds || !conforming) throw new Error('ept.json sans emprise.');
  // Les entrées du schéma, par nom.
  const schema = new Map<string, { scale?: unknown; offset?: unknown }>();
  // Range chaque entrée nommée.
  for (const s of Array.isArray(j.schema) ? (j.schema as { name?: string }[]) : []) if (typeof s?.name === 'string') schema.set(s.name, s as { scale?: unknown; offset?: unknown });
  // Échelle et décalage des trois axes, lues dans le schéma.
  const axis = (n: string): [number, number] => [Number(schema.get(n)?.scale ?? 0.01) || 0.01, Number(schema.get(n)?.offset ?? 0)];
  // Renvoie les informations de la dalle.
  return {
    // Cube racine et emprise réelle.
    bounds, conforming,
    // Écart de la grille et points annoncés.
    span: Number(j.span) || 128, points: Number(j.points) || 0,
    // Échelles et décalages.
    scale: [axis('X')[0], axis('Y')[0], axis('Z')[0]], offset: [axis('X')[1], axis('Y')[1], axis('Z')[1]],
  // Fin des informations.
  };
// Fin de parseEptInfo.
}

/**
 * Hiérarchie lue dans une page (ept-hierarchy/<clé>.json) : les entrées dont la clé est au format octree et le
 * nombre un entier ; −1 marque la suite de l'arbre dans le fichier de cette clé.
 */
// Fonction parseEptHierarchy : la réponse JSON de la page.
export function parseEptHierarchy(json: unknown): EptEntry[] {
  // Les paires clé/valeur de la page.
  const entries = Object.entries((json ?? {}) as Record<string, unknown>);
  // Entrées lues.
  const out: EptEntry[] = [];
  // Pour chaque paire (début).
  for (const [key, count] of entries) {
    // La clé décomposée.
    const k = parseEptKey(key);
    // Clé illisible ou nombre invalide : suivante.
    if (!k || typeof count !== 'number' || !Number.isInteger(count) || count < -1) continue;
    // Garde l'entrée.
    out.push({ key, ...k, count });
  // Fin des paires.
  }
  // Renvoie les entrées.
  return out;
// Fin de parseEptHierarchy.
}

/** Une cellule de niveau 6 de l'octree EPT (une dalle du navigateur) : ses indices dans la grille. */
// Déclare et exporte l'interface de la cellule.
export interface EptCell { d: number; x: number; y: number; z: number }

/** Clé d'une cellule. */
// Déclare et exporte eptCellKey : la cellule.
export const eptCellKey = (c: EptCell): string => `${c.d}-${c.x}-${c.y}-${c.z}`;

/** Le nœud est-il dans la cellule (elle-même ou un de ses descendants) ? */
// Fonction inCell : la cellule et le nœud.
export const inCell = (cell: EptEntry | EptCell, k: { level: number; x: number; y: number; z: number }): boolean => {
  // Le nœud est plus haut que la cellule : non.
  if (k.level < cell.d) return false;
  // Ses indices ramenés au niveau de la cellule.
  const s = k.level - cell.d;
  // Dans la cellule si les trois indices concordent.
  return (k.x >> s) === cell.x && (k.y >> s) === cell.y && (k.z >> s) === cell.z;
// Fin de inCell.
};

/**
  * Identifiant d'une dalle du navigateur : une cellule de niveau 6 « ept-ke-6-31-42-7 », ou null si le texte n'a pas
 * cette forme (les identifiants COPC « lhd-… » sortent ici). Le niveau est toujours 6 : la forme fixe des adresses
 * EPT (« ept-xx ») garde le décodage non ambigu.
 */
// Déclare et exporte parseEptTileId : l'identifiant.
export function parseEptTileId(id: string): { dalle: string; cell: EptCell } | null {
  // Les quatre nombres finaux et le code de la dalle EPT.
  const m = /^ept-([a-z]{2})-(\d{1,2})-(\d{1,5})-(\d{1,5})-(\d{1,5})$/.exec(id);
  // Illisible : null.
  if (!m) return null;
  // Le niveau tel qu'écrit, et les indices.
  const d = Number(m[2]);
  // Le niveau n'est pas celui des dalles servies : null.
  if (d !== EPT_TILE_DEPTH) return null;
  // Renvoie la dalle et la cellule.
  return { dalle: `ept-${m[1]}`, cell: { d, x: Number(m[3]), y: Number(m[4]), z: Number(m[5]) } };
// Fin de parseEptTileId.
}

/** Identifiant écrit d'une dalle du navigateur (une cellule de niveau 6). */
// Déclare et exporte eptTileId : le code de la dalle EPT et la cellule.
export const eptTileId = (code: string, cell: EptCell): string => `ept-${code}-${cell.d}-${cell.x}-${cell.y}-${cell.z}`;

/**
 * Clé EPT d'un nœud → clé du LidarEngine dans sa cellule : le niveau compte depuis celui de la cellule et les
 * indices repartent de zéro. La racine de la cellule devient « 0-0-0-0 ». Null si le nœud n'est pas dans la cellule.
 */
// Fonction rekeyToTile : la clé EPT et la cellule.
export function rekeyToTile(key: string, cell: EptCell): string | null {
  // La clé décomposée.
  const k = parseEptKey(key);
  // Illisible ou hors de la cellule : null.
  if (!k || !inCell(cell, k)) return null;
  // Le décalage de niveau entre l'octree EPT et la dalle.
  const s = k.level - cell.d;
  // Renvoie la clé renumérotée.
  return `${s}-${k.x - (cell.x << s)}-${k.y - (cell.y << s)}-${k.z - (cell.z << s)}`;
// Fin de rekeyToTile.
}

/** Clé du LidarEngine → clé EPT (l'inverse de rekeyToTile). */
// Fonction rekeyToEpt : la clé de la dalle et la cellule.
export function rekeyToEpt(key: string, cell: EptCell): string | null {
  // La clé décomposée.
  const k = parseEptKey(key);
  // Illisible : null.
  if (!k) return null;
  // Le niveau EPT et le décalage d'indice.
  const level = k.level + cell.d, s = k.level;
  // Renvoie la clé EPT.
  return `${level}-${k.x + (cell.x << s)}-${k.y + (cell.y << s)}-${k.z + (cell.z << s)}`;
// Fin de rekeyToEpt.
}

/** Emprise (m Lambert-93) d'une cellule de niveau 6 : un cube ouvert sur l'octree EPT (elle couvre la dalle entière). */
// Fonction cellBounds : le ept.json de la dalle et la cellule.
export function cellBounds({ bounds }: EptInfo, c: { d: number; x: number; y: number; z: number }): EptBbox {
  // Côté des cellules au niveau de la dalle.
  const side = (bounds[3] - bounds[0]) / 2 ** c.d;
  // Le cube de la cellule.
  return [bounds[0] + c.x * side, bounds[1] + c.y * side, bounds[2] + c.z * side, bounds[0] + (c.x + 1) * side, bounds[1] + (c.y + 1) * side, bounds[2] + (c.z + 1) * side];
// Fin de cellBounds.
}

/**
 * Cellules de niveau 6 d'une dalle qui touchent une emprise Lambert-93 (X/Y seulement) : les cases de la grille du
 * cube racine qui recouvrent l'emprise, en X et Y sur l'emprise entière, en Z sur la hauteur réelle des points
 * (l'emprise « conforming » du ept.json, quelques dizaines de mètres le long d'une verticale).
 */
// Fonction cellsInBox : le ept.json et l'emprise Lambert-93 [X ouest, Y sud, X est, Y nord].
export function cellsInBox(info: EptInfo, box: [number, number, number, number]): EptCell[] {
  // Côté des cellules de niveau 6.
  const side = (info.bounds[3] - info.bounds[0]) / 2 ** EPT_TILE_DEPTH;
  // Garde : dalle sans cube.
  if (!(side > 0)) return [];
  // Bornes entières sur X, Y : l'emprise donnée taillée à la dalle.
  const x0 = Math.max(0, Math.floor((box[0] - info.bounds[0]) / side)), x1 = Math.min(2 ** EPT_TILE_DEPTH - 1, Math.floor((box[2] - info.bounds[0]) / side));
  const y0 = Math.max(0, Math.floor((box[1] - info.bounds[1]) / side)), y1 = Math.min(2 ** EPT_TILE_DEPTH - 1, Math.floor((box[3] - info.bounds[1]) / side));
  // Bornes en Z : la hauteur réelle des points, dans le cube racine.
  const z0 = Math.max(0, Math.floor((info.conforming[2] - info.bounds[2]) / side)), z1 = Math.min(2 ** EPT_TILE_DEPTH - 1, Math.floor((info.conforming[5] - info.bounds[2]) / side));
  // Cellules retenues.
  const out: EptCell[] = [];
  // Pour chaque case de la grille (début).
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) out.push({ d: EPT_TILE_DEPTH, x, y, z });
  // Renvoie les cellules.
  return out;
// Fin de cellsInBox.
}

/** En-tête d'un nuage de nœud EPT (ept-data/<clé>.laz) tel qu'Entwine l'écrit. */
export interface EptLazHeader { dataStart: number; count: number; pointFormat: number }

/**
 * En-tête d'un fichier de nœud EPT : LAS 1.4, format de point 6. Les nœuds d'Entwine tiennent en un seul bloc
 * laszip (pas de table de chunks, même au-delà de 100 000 points, vérifié sur les dalles de l'IGN), des VLR jusqu'au
 * début des points. L'adresse des points y est écrite avec quatre gigaoctets de trop (particularité d'Entwine) :
 * seule la partie basse est gardée.
 */
// Fonction parseEptLazHeader : les octets du fichier.
export function parseEptLazHeader(buf: Buffer): EptLazHeader {
  // Trop court pour un en-tête LAS 1.4 : erreur.
  if (buf.length < 375) throw new Error('Fichier de nœud trop court.');
  // Signature LAS et version 1.4.
  if (buf.toString('latin1', 0, 4) !== 'LASF' || buf[24] !== 1 || buf[25] !== 4) throw new Error('Fichier LAS 1.4 attendu.');
  // Format de point (bits de poids bas ; le bit de compression d'un LAZ est relevé ici).
  const pointFormat = buf[104] & 0x3f;
  // Seul le format de point 6 (celui du LiDAR HD) est décodé.
  if (pointFormat !== 6) throw new Error(`Format de point ${pointFormat} non pris en charge.`);
  // L'adresse écrite des points, privée de ses quatre gigaoctets de trop (particularité d'Entwine).
  const written = Number(buf.readBigUInt64LE(96));
  let dataStart = written & 0xFFFFFFFF;
  // Hors du fichier : la véritable adresse, la fin des VLR, lue depuis l'en-tête (LAS 1.4 : 375 octets).
  if (!(dataStart > 0 && dataStart < buf.length)) {
    // Parcourt les VLR depuis la fin de l'en-tête.
    let p = 375;
    // Nombre de VLR.
    const n = buf.readUInt32LE(100);
    // Une par une (début).
    for (let i = 0; i < n && p + 54 <= buf.length; i++) { const len = buf.readUInt16LE(p + 20); p += 54 + len; }
    // L'adresse est cette fin.
    dataStart = p;
  // Fin de la vérification.
  }
  // Encore hors du fichier : erreur.
  if (!(dataStart > 0 && dataStart < buf.length)) throw new Error('Adresse des points illisible.');
  // Nombre de points du nœud (LAS 1.4 : entier de 64 bits).
  const count = Number(buf.readBigUInt64LE(247));
  // Renvoie l'adresse des points, le nombre et le format.
  return { dataStart, count, pointFormat };
// Fin de parseEptLazHeader.
}
