/**
 * Placement automatique d'une contribution sur le globe à partir de l'en-tête de son fichier LAS/LAZ.
 *
 * Le navigateur lit l'en-tête du fichier (emprise, nombre de points, système de coordonnées déclaré) et l'envoie ;
 * le serveur refait seul le calcul de position, sans faire confiance au client. Deux systèmes sont acceptés :
 *  - EPSG:2154 (Lambert-93) : celui des dalles LiDAR HD de l'IGN, reconnu même quand le fichier ne le déclare pas,
 *    par l'emprise des coordonnées (France métropolitaine) ;
 *  - EPSG:4326 (degrés WGS84) : quelques relevés sont livrés ainsi.
 * Le résultat a la forme d'un nuage du projet — `bounds` natif plus `anchor` { lat, lon, alt, heading } — si bien
 * que l'affichage réutilise les mathématiques des dalles LiDAR déjà en place (moteur/engine/lidarAnchor.jsx).
 */
import { Bounds, IgnTile, LatLon, gridNorthHeading, ignTileAt, inFranceLambert93, lambert93ToWgs84, wgs84ToLambert93 } from './lambert93';

/** Côté maximal accepté pour l'emprise d'une contribution (m) : une dalle IGN fait 1 km, une livraison groupée moins de 50 km. */
export const MAX_SPAN_METERS = 50_000;
/** Nombre de points maximal accepté dans l'en-tête (un milliard : au-delà, l'en-tête est suspect). */
export const MAX_POINTS = 1_000_000_000;

/** En-tête de fichier LAS/LAZ reçu du navigateur. */
export interface LasHeaderInput {
  /** Emprise déclarée par l'en-tête, en coordonnées natives. */
  bounds: Bounds;
  /** Nombre de points déclaré. */
  pointCount: number;
  /** Code EPSG lu dans les clés GeoTIFF de l'en-tête, s'il y en a. */
  epsg?: number | null;
  /** Description WKT du système de coordonnées, si le fichier en porte une. */
  crsWkt?: string | null;
}

/** Système de coordonnées retenu pour un fichier. */
export type PlacementCrs = 'EPSG:2154' | 'EPSG:4326';

/** Position calculée d'une contribution. */
export interface Placement {
  /** Système de coordonnées retenu. */
  crs: PlacementCrs;
  /** `declare` : le fichier le dit lui-même ; `deduit` : reconnu à l'emprise des coordonnées. */
  crsSource: 'declare' | 'deduit';
  /** Calage GPS, même convention que les dalles LiDAR : posé au centre de l'emprise, en bas du nuage. */
  anchor: { lat: number; lon: number; alt: number; heading: number };
  /** Les quatre coins du bas de l'emprise, en WGS84 (contrôle visuel du placement). */
  footprint: LatLon[];
  /** Côtés de l'emprise en mètres : est-ouest, nord-sud, hauteur. */
  sizeMeters: [number, number, number];
  /** Dalle LiDAR HD de l'IGN qui contient le centre, ou null hors de France métropolitaine. */
  tile: IgnTile | null;
}

/** Refus de placement : le message est montré tel quel au contributeur. */
export class PlacementError extends Error {}

/** Nombre fini ? */
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Vérifie la forme de l'emprise : six nombres finis et minimums sous les maximums. Contrôle fait avant de
 *  reconnaître le système de coordonnées, puisque celui-ci se déduit en partie des coordonnées elles-mêmes. */
function checkBoundsShape(b: Bounds): void {
  // Les six valeurs sont des nombres finis.
  if (![b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ].every(num)) throw new PlacementError('L’emprise du fichier est incomplète ou illisible.');
  // Les minimums sont sous les maximums.
  if (b.minX > b.maxX || b.minY > b.maxY || b.minZ > b.maxZ) throw new PlacementError('L’emprise du fichier est incohérente (minimum au-dessus du maximum).');
// Fin de checkBoundsShape.
}

/** Vérifie les côtés de l'emprise, une fois l'unité connue (mètres, ou degrés à convertir). */
function checkSpan(b: Bounds, degrees: boolean): void {
  // Côtés horizontaux, convertis en mètres pour les degrés (1° de latitude ≈ 111 320 m).
  const spanX = degrees ? (b.maxX - b.minX) * 111_320 * Math.cos(((b.minY + b.maxY) / 2) * (Math.PI / 180)) : b.maxX - b.minX;
  const spanY = degrees ? (b.maxY - b.minY) * 111_320 : b.maxY - b.minY;
  // Le nuage a une étendue.
  if (spanX <= 0 || spanY <= 0) throw new PlacementError('L’emprise du fichier est plate : impossible de la placer.');
  // Et elle reste d'une taille plausible.
  if (spanX > MAX_SPAN_METERS || spanY > MAX_SPAN_METERS) throw new PlacementError(`L’emprise dépasse ${MAX_SPAN_METERS / 1000} km de côté : ce n’est pas un relevé local.`);
// Fin de checkSpan.
}

/** Le texte WKT désigne-t-il le Lambert-93 ? */
const wktIsLambert93 = (wkt: string) => /lambert[\s_-]*93|RGF93|\b2154\b/i.test(wkt);
/** Le texte WKT désigne-t-il des degrés géographiques ? */
const wktIsDegrees = (wkt: string) => /GEOGCS|GEOGCRS/i.test(wkt) && !/PROJCS|PROJCRS/i.test(wkt);

/** L'emprise tient-elle dans les bornes des degrés ? */
const looksLikeDegrees = (b: Bounds) => Math.abs(b.minX) <= 180 && Math.abs(b.maxX) <= 180 && Math.abs(b.minY) <= 90 && Math.abs(b.maxY) <= 90;

/** Système de coordonnées du fichier : ce qu'il déclare, sinon ce que son emprise laisse reconnaître. */
export function detectCrs(header: LasHeaderInput): { crs: PlacementCrs; crsSource: 'declare' | 'deduit' } {
  // Code EPSG déclaré dans les clés GeoTIFF.
  const epsg = header.epsg ?? null;
  // Lambert-93 déclaré.
  if (epsg === 2154) return { crs: 'EPSG:2154', crsSource: 'declare' };
  // Degrés WGS84 déclarés (4326 plan, 4979 avec altitude).
  if (epsg === 4326 || epsg === 4979) return { crs: 'EPSG:4326', crsSource: 'declare' };
  // Description WKT, quand elle est présente.
  const wkt = (header.crsWkt || '').trim();
  // Lambert-93 reconnu dans le WKT.
  if (wkt && wktIsLambert93(wkt)) return { crs: 'EPSG:2154', crsSource: 'declare' };
  // Degrés reconnus dans le WKT, emprise cohérente.
  if (wkt && wktIsDegrees(wkt) && looksLikeDegrees(header.bounds)) return { crs: 'EPSG:4326', crsSource: 'declare' };
  // Rien de déclaré : une emprise dans le Lambert-93 de la métropole suffit à reconnaître une dalle IGN.
  const b = header.bounds;
  // Coins de l'emprise testés contre l'emprise française.
  if (inFranceLambert93(b.minX, b.minY) && inFranceLambert93(b.maxX, b.maxY)) return { crs: 'EPSG:2154', crsSource: 'deduit' };
  // À défaut, des coordonnées en degrés.
  if (looksLikeDegrees(b)) return { crs: 'EPSG:4326', crsSource: 'deduit' };
  // Sinon le fichier n'est pas plaçable : un autre système projeté (UTM, local) n'est pas pris en charge.
  throw new PlacementError('Système de coordonnées non reconnu : seuls le Lambert-93 (EPSG:2154, LiDAR HD de l’IGN) et les degrés WGS84 (EPSG:4326) sont pris en charge.');
}

/** Position d'une contribution d'après l'en-tête de son fichier. Lève PlacementError si le fichier n'est pas plaçable. */
export function placeFromHeader(header: LasHeaderInput): Placement {
  // Nombre de points plausible.
  if (!num(header.pointCount) || header.pointCount < 1 || header.pointCount > MAX_POINTS) {
    throw new PlacementError('Le nombre de points déclaré par l’en-tête est invalide.');
  }
  // Emprise bien formée : six nombres finis, dans le bon ordre.
  const b = header.bounds;
  checkBoundsShape(b);
  // Système de coordonnées : déclaré par le fichier, ou reconnu à l'emprise.
  const { crs, crsSource } = detectCrs(header);
  // Côtés de l'emprise vérifiés dans leur unité.
  checkSpan(b, crs === 'EPSG:4326');
  // Centre de l'emprise horizontale : le point sur lequel le calage est posé.
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  // Les quatre coins du bas, dans l'ordre sud-ouest, sud-est, nord-est, nord-ouest.
  const corners: [number, number][] = [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
  // Cas Lambert-93 : la conversion donne la position, et la convergence des méridiens donne le cap de la grille.
  if (crs === 'EPSG:2154') {
    // Centre en WGS84.
    const c = lambert93ToWgs84(cx, cy);
    // Le placement complet.
    return {
      crs,
      crsSource,
      anchor: { lat: c.lat, lon: c.lon, alt: b.minZ, heading: gridNorthHeading(cx, cy) },
      footprint: corners.map(([x, y]) => lambert93ToWgs84(x, y)),
      sizeMeters: [b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ],
      tile: ignTileAt(cx, cy),
    };
  // Fin du cas Lambert-93.
  }
  // Cas des degrés : X est la longitude, Y la latitude ; la grille est déjà orientée au nord.
  const spanY = (b.maxY - b.minY) * 111_320;
  const spanX = (b.maxX - b.minX) * 111_320 * Math.cos(cy * (Math.PI / 180));
  // Le centre en Lambert-93 sert à retrouver la dalle IGN quand le relevé est en France.
  const l93 = wgs84ToLambert93(cy, cx);
  // Le placement complet.
  return {
    crs,
    crsSource,
    anchor: { lat: cy, lon: cx, alt: b.minZ, heading: 0 },
    footprint: corners.map(([x, y]) => ({ lat: y, lon: x })),
    sizeMeters: [spanX, spanY, b.maxZ - b.minZ],
    tile: inFranceLambert93(l93.east, l93.north) ? ignTileAt(l93.east, l93.north) : null,
  };
// Fin de placeFromHeader.
}

/**
 * Emprise à enregistrer pour l'affichage : en degrés, le moteur attend des mètres autour du calage, donc
 * l'emprise est recentrée en mètres. En Lambert-93 l'emprise native est déjà métrique et conservée telle quelle.
 */
export function storedBounds(header: LasHeaderInput, placement: Placement): Bounds {
  // Lambert-93 : l'emprise native est gardée, le moteur la rapporte au calage.
  if (placement.crs === 'EPSG:2154') return { ...header.bounds };
  // Degrés : emprise métrique centrée sur le calage.
  const [sx, sy] = placement.sizeMeters;
  // Les bornes en mètres, centrées.
  return { minX: -sx / 2, minY: -sy / 2, minZ: header.bounds.minZ, maxX: sx / 2, maxY: sy / 2, maxZ: header.bounds.maxZ };
}
