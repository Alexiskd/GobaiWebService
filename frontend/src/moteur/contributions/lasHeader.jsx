/**
 * Lecture de l'en-tête d'un fichier LAS/LAZ dans le navigateur, sans dépendance et sans lire les points.
 *
 * Seuls les premiers kilo-octets du fichier sont lus (`File.slice`) : l'emprise, le nombre de points et le système
 * de coordonnées suffisent à placer un relevé sur le globe. Le fichier lui-même n'est jamais envoyé au serveur —
 * une dalle LiDAR HD pèse plusieurs centaines de méga-octets et reste sur l'appareil du contributeur.
 *
 * Références : spécification ASPRS LAS 1.4 R15 (en-tête de 375 octets, enregistrements VLR de 54 octets, EVLR de
 * 60 octets) et OGC GeoTIFF (clés de projection de l'enregistrement 34735).
 */

/** Tailles d'en-tête : le minimum LAS 1.2 et le maximum LAS 1.4. */
const HEADER_MIN = 227;
const HEADER_MAX = 375;
/** Nombre d'enregistrements VLR au-delà duquel le fichier est jugé douteux. */
const MAX_VLR = 4096;
/** Taille maximale lue pour une description WKT. */
const MAX_WKT = 100_000;
/** Nombre de points au-delà duquel l'en-tête est jugé douteux (le serveur applique la même borne). */
export const MAX_POINTS = 1_000_000_000;

/** Identifiant des enregistrements de projection. */
const PROJECTION_USER = 'LASF_Projection';
/** Enregistrement de la description WKT du système de coordonnées. */
const RECORD_WKT = 2112;
/** Enregistrement des clés GeoTIFF. */
const RECORD_GEOKEYS = 34735;
/** Clé GeoTIFF du système projeté (son code EPSG). */
const KEY_PROJECTED = 3072;
/** Clé GeoTIFF du système géographique (son code EPSG). */
const KEY_GEOGRAPHIC = 2048;

/** Texte d'un bloc d'octets, sans les zéros de remplissage. */
const decode = (buffer) => new TextDecoder('utf-8', { fatal: false }).decode(buffer).replace(/\0+$/, '').trim();

/** Refus de lecture : le message est montré tel quel au contributeur. */
export class LasError extends Error {}

/**
 * En-tête fixe d'un fichier LAS, lu dans ses 375 premiers octets.
 * @param {ArrayBuffer} data les premiers octets du fichier
 */
export function parseLasHeader(data) {
  // Vue sur les octets.
  const view = new DataView(data);
  // Signature « LASF » et taille minimale.
  if (data.byteLength < HEADER_MIN || decode(data.slice(0, 4)) !== 'LASF') throw new LasError('Ce fichier n’est pas un LAS/LAZ : la signature « LASF » est absente.');
  // Version du format.
  const major = view.getUint8(24);
  const minor = view.getUint8(25);
  // Seules les versions 1.0 à 1.4 sont connues.
  if (major !== 1 || minor > 4) throw new LasError(`Version LAS non prise en charge : ${major}.${minor}.`);
  // Taille de l'en-tête et début des points.
  const headerSize = view.getUint16(94, true);
  const pointDataOffset = view.getUint32(96, true);
  // En-tête cohérent.
  if (headerSize < HEADER_MIN || data.byteLength < Math.min(headerSize, HEADER_MAX)) throw new LasError('En-tête LAS tronqué ou de taille incohérente.');
  // Nombre d'enregistrements VLR.
  const vlrCount = view.getUint32(100, true);
  // Format de point : les deux bits hauts signalent la compression LAZ.
  const flags = view.getUint8(104);
  // Nombre de points : le champ étendu de LAS 1.4 l'emporte sur le champ historique.
  const legacy = view.getUint32(107, true);
  const extended = minor === 4 && headerSize >= HEADER_MAX && data.byteLength >= HEADER_MAX ? Number(view.getBigUint64(247, true)) : 0;
  // L'en-tête lu.
  return {
    version: `${major}.${minor}`,
    pointFormat: flags & 0x3f,
    compressed: (flags & 0xc0) !== 0,
    pointCount: extended || legacy,
    headerSize,
    pointDataOffset,
    vlrCount,
    // Emprise : l'en-tête range les maximums avant les minimums.
    bounds: {
      maxX: view.getFloat64(179, true),
      minX: view.getFloat64(187, true),
      maxY: view.getFloat64(195, true),
      minY: view.getFloat64(203, true),
      maxZ: view.getFloat64(211, true),
      minZ: view.getFloat64(219, true),
    },
    // Emplacement des enregistrements étendus (LAS 1.4 seulement).
    evlrOffset: minor === 4 && data.byteLength >= HEADER_MAX ? Number(view.getBigUint64(235, true)) : 0,
    evlrCount: minor === 4 && data.byteLength >= HEADER_MAX ? view.getUint32(243, true) : 0,
  };
// Fin de parseLasHeader.
}

/** Code EPSG lu dans un bloc de clés GeoTIFF (enregistrement 34735), ou null. */
export function parseGeoKeys(data) {
  // Vue sur les octets.
  const view = new DataView(data);
  // Au moins l'en-tête de quatre entiers.
  if (data.byteLength < 8) return null;
  // Nombre de clés annoncé.
  const count = view.getUint16(6, true);
  // Codes trouvés : celui du système projeté, puis celui du système géographique.
  let projected = null;
  let geographic = null;
  // Parcourt les clés, quatre entiers chacune.
  for (let i = 0; i < count; i++) {
    // Position de la clé.
    const at = 8 + i * 8;
    // Bloc incomplet : on s'arrête.
    if (at + 8 > data.byteLength) break;
    // Identifiant de la clé, emplacement de sa valeur et valeur immédiate.
    const key = view.getUint16(at, true);
    const location = view.getUint16(at + 2, true);
    const value = view.getUint16(at + 6, true);
    // Seules les valeurs rangées dans la clé même sont lues (location = 0).
    if (location !== 0) continue;
    // Système projeté.
    if (key === KEY_PROJECTED) projected = value;
    // Système géographique.
    if (key === KEY_GEOGRAPHIC) geographic = value;
  // Fin du parcours.
  }
  // Le code projeté d'abord : c'est lui qui décrit le Lambert-93 d'une dalle IGN.
  const epsg = projected || geographic || null;
  // Les codes 0 et 32767 (« défini par l'utilisateur ») ne désignent rien.
  return epsg && epsg !== 32_767 ? epsg : null;
// Fin de parseGeoKeys.
}

/**
 * Système de coordonnées déclaré par le fichier : { epsg, wkt }, l'un ou l'autre pouvant être null.
 * Les enregistrements VLR sont parcourus une fois, puis les EVLR de LAS 1.4 si rien n'a été trouvé.
 */
export async function readLasCrs(file, header) {
  // Résultat.
  let epsg = null;
  let wkt = null;
  // Trop d'enregistrements : fichier douteux, rien n'est lu.
  if (header.vlrCount > MAX_VLR) return { epsg, wkt };
  // Position du premier enregistrement.
  let at = header.headerSize;
  // Parcourt les enregistrements VLR.
  for (let i = 0; i < header.vlrCount; i++) {
    // L'en-tête d'un VLR fait 54 octets et doit tenir avant les points.
    if (at + 54 > header.pointDataOffset) break;
    // Lit cet en-tête.
    const head = await file.slice(at, at + 54).arrayBuffer();
    // Enregistrement tronqué.
    if (head.byteLength < 54) break;
    // Vue sur l'en-tête.
    const view = new DataView(head);
    // Identifiant du producteur, numéro et longueur de l'enregistrement.
    const userId = decode(head.slice(2, 18));
    const recordId = view.getUint16(18, true);
    const length = view.getUint16(20, true);
    // Début des données de l'enregistrement.
    const start = at + 54;
    // Données hors du fichier : on s'arrête.
    if (start + length > header.pointDataOffset) break;
    // Enregistrement de projection : on lit ce qui nous intéresse.
    if (userId === PROJECTION_USER && length > 0) {
      // Description WKT.
      if (recordId === RECORD_WKT && length <= MAX_WKT) wkt = decode(await file.slice(start, start + length).arrayBuffer()) || null;
      // Clés GeoTIFF.
      if (recordId === RECORD_GEOKEYS && length <= 65_536) epsg = parseGeoKeys(await file.slice(start, start + length).arrayBuffer()) ?? epsg;
    // Fin de l'enregistrement de projection.
    }
    // Enregistrement suivant.
    at = start + length;
  // Fin du parcours.
  }
  // Tout trouvé, ou pas d'enregistrements étendus : terminé.
  if (wkt || !header.evlrCount || header.evlrCount > MAX_VLR || !header.evlrOffset) return { epsg, wkt };
  // Parcourt les enregistrements étendus (en-tête de 60 octets, longueur sur 64 bits).
  at = header.evlrOffset;
  // Même boucle, bornée par la taille du fichier.
  for (let i = 0; i < header.evlrCount; i++) {
    // Lit l'en-tête étendu.
    const head = await file.slice(at, at + 60).arrayBuffer();
    // Enregistrement tronqué.
    if (head.byteLength < 60) break;
    // Vue sur l'en-tête.
    const view = new DataView(head);
    // Identifiant, numéro et longueur.
    const userId = decode(head.slice(2, 18));
    const recordId = view.getUint16(18, true);
    const length = Number(view.getBigUint64(20, true));
    // Début des données.
    const start = at + 60;
    // Longueur invalide ou hors du fichier.
    if (!Number.isSafeInteger(length) || length < 0 || start + length > file.size) break;
    // Description WKT étendue.
    if (userId === PROJECTION_USER && recordId === RECORD_WKT && length > 0 && length <= MAX_WKT) {
      // Lue puis gardée.
      wkt = decode(await file.slice(start, start + length).arrayBuffer()) || null;
      // Terminé.
      break;
    // Fin de la description.
    }
    // Enregistrement suivant.
    at = start + length;
  // Fin du parcours.
  }
  // Le système déclaré.
  return { epsg, wkt };
// Fin de readLasCrs.
}

/**
 * Tout ce qu'un fichier LAS/LAZ dit de lui-même, sans lire ses points.
 * @param {File|Blob & { name?: string }} file le fichier choisi par le contributeur
 */
export async function inspectLasFile(file) {
  // Nom et extension.
  const name = file.name || 'releve.laz';
  // Extension attendue (le .copc.laz des dalles IGN finit aussi par .laz).
  if (!/\.(las|laz)$/i.test(name)) throw new LasError('Seuls les fichiers .las et .laz sont acceptés.');
  // Fichier vide.
  if (!file.size) throw new LasError('Ce fichier est vide.');
  // En-tête fixe.
  const header = parseLasHeader(await file.slice(0, HEADER_MAX).arrayBuffer());
  // Nombre de points plausible.
  if (!Number.isFinite(header.pointCount) || header.pointCount < 1 || header.pointCount > MAX_POINTS) {
    throw new LasError('Le nombre de points déclaré par l’en-tête est invalide.');
  // Fin du contrôle.
  }
  // Système de coordonnées déclaré.
  const { epsg, wkt } = await readLasCrs(file, header);
  // Le relevé décrit.
  return {
    filename: name,
    sizeBytes: file.size,
    version: header.version,
    pointFormat: header.pointFormat,
    compressed: header.compressed,
    pointCount: header.pointCount,
    bounds: header.bounds,
    epsg,
    crsWkt: wkt,
  };
// Fin de inspectLasFile.
}

/** Ce que l'API attend dans le champ `header` : rien de plus que ce qui sert à placer le relevé. */
export function headerPayload(info) {
  // Emprise et nombre de points, toujours.
  const payload = { bounds: { ...info.bounds }, pointCount: info.pointCount };
  // Code EPSG, s'il a été lu.
  if (info.epsg) payload.epsg = info.epsg;
  // Description WKT, si elle a été lue (bornée comme côté serveur).
  if (info.crsWkt) payload.crsWkt = info.crsWkt.slice(0, 20_000);
  // La charge envoyée.
  return payload;
// Fin de headerPayload.
}
