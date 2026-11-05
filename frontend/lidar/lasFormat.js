// Format LAS 1.0 à 1.4 : en-tête, VLR (système de coordonnées) et lecture des points des formats 0 à 10.
// Aucune dépendance (testable avec node --test). Un fichier LAZ a le même en-tête : seuls les points sont compressés.

/** Taille minimale et champs présents pour chaque format de point. */
export const POINT_FORMATS = {
  0: { size: 20, extended: false, gps: false, rgb: -1 },
  1: { size: 28, extended: false, gps: true, rgb: -1 },
  2: { size: 26, extended: false, gps: false, rgb: 20 },
  3: { size: 34, extended: false, gps: true, rgb: 28 },
  4: { size: 57, extended: false, gps: true, rgb: -1 },
  5: { size: 63, extended: false, gps: true, rgb: 28 },
  6: { size: 30, extended: true, gps: true, rgb: -1 },
  7: { size: 36, extended: true, gps: true, rgb: 30 },
  8: { size: 38, extended: true, gps: true, rgb: 30 },
  9: { size: 59, extended: true, gps: true, rgb: -1 },
  10: { size: 67, extended: true, gps: true, rgb: 30 },
};

const text = (view, offset, length) => {
  let s = '';
  for (let i = 0; i < length; i++) {
    const c = view.getUint8(offset + i);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim();
};

const u64 = (view, offset) => Number(view.getBigUint64(offset, true));

/**
 * Lit l'en-tête d'un fichier LAS ou LAZ.
 * @param {ArrayBuffer} buffer  au moins les premiers octets du fichier (en-tête + VLR)
 */
export function readLasHeader(buffer) {
  if (buffer.byteLength < 227) throw new Error('Fichier trop court pour être un LAS/LAZ.');
  const view = new DataView(buffer);
  if (text(view, 0, 4) !== 'LASF') throw new Error('Signature « LASF » absente : ce n’est pas un fichier LAS/LAZ.');

  const versionMajor = view.getUint8(24);
  const versionMinor = view.getUint8(25);
  const rawFormat = view.getUint8(104);
  const pointFormat = rawFormat & 0x3f;          // bits 6 et 7 : marqueurs de compression LAZ
  const compressed = (rawFormat & 0xc0) !== 0;
  if (!POINT_FORMATS[pointFormat]) throw new Error(`Format de point ${pointFormat} non pris en charge.`);

  const header = {
    versionMajor,
    versionMinor,
    version: `${versionMajor}.${versionMinor}`,
    systemId: text(view, 26, 32),
    software: text(view, 58, 32),
    creationDay: view.getUint16(90, true),
    creationYear: view.getUint16(92, true),
    headerSize: view.getUint16(94, true),
    offsetToPointData: view.getUint32(96, true),
    vlrCount: view.getUint32(100, true),
    pointFormat,
    compressed,
    pointRecordLength: view.getUint16(105, true),
    pointCount: view.getUint32(107, true),
    scale: [view.getFloat64(131, true), view.getFloat64(139, true), view.getFloat64(147, true)],
    offset: [view.getFloat64(155, true), view.getFloat64(163, true), view.getFloat64(171, true)],
    max: [view.getFloat64(179, true), view.getFloat64(195, true), view.getFloat64(211, true)],
    min: [view.getFloat64(187, true), view.getFloat64(203, true), view.getFloat64(219, true)],
  };
  // LAS 1.4 : nombre de points sur 64 bits (le champ 32 bits vaut 0 au-delà de 4,29 milliards ou pour les formats 6+).
  if (versionMinor >= 4 && header.headerSize >= 375 && buffer.byteLength >= 255) {
    const count64 = u64(view, 247);
    if (header.pointCount === 0 || count64 > header.pointCount) header.pointCount = count64;
  }
  if (header.pointRecordLength < POINT_FORMATS[pointFormat].size) {
    throw new Error(`Longueur d’enregistrement ${header.pointRecordLength} trop courte pour le format ${pointFormat}.`);
  }
  header.hasRgb = POINT_FORMATS[pointFormat].rgb >= 0;
  header.crs = readCrs(view, header);
  return header;
}

/** Système de coordonnées depuis les VLR : clé GeoTIFF (EPSG) ou WKT. */
function readCrs(view, header) {
  const crs = { epsg: null, verticalEpsg: null, wkt: null };
  let offset = header.headerSize;
  for (let v = 0; v < header.vlrCount; v++) {
    if (offset + 54 > view.byteLength) break;
    const userId = text(view, offset + 2, 16);
    const recordId = view.getUint16(offset + 18, true);
    const length = view.getUint16(offset + 20, true);
    const data = offset + 54;
    if (data + length > view.byteLength) break;
    if (userId === 'LASF_Projection' && recordId === 34735 && length >= 8) {
      const keys = view.getUint16(data + 6, true);
      for (let k = 0; k < keys; k++) {
        const base = data + 8 + k * 8;
        if (base + 8 > data + length) break;
        const keyId = view.getUint16(base, true);
        const location = view.getUint16(base + 2, true);
        const value = view.getUint16(base + 6, true);
        if (location !== 0) continue;
        if (keyId === 3072) crs.epsg = value;                       // ProjectedCSTypeGeoKey
        else if (keyId === 2048 && !crs.epsg) crs.epsg = value;     // GeographicTypeGeoKey
        else if (keyId === 4096) crs.verticalEpsg = value;          // VerticalCSTypeGeoKey
      }
    } else if (userId === 'LASF_Projection' && recordId === 2112) {
      crs.wkt = text(view, data, length);
      if (!crs.epsg) {
        // L'autorité la plus externe est la dernière du texte : c'est celle du système complet.
        const all = [...crs.wkt.matchAll(/(?:AUTHORITY|ID)\[\s*"EPSG"\s*,\s*"?(\d+)"?\s*\]/gi)];
        if (all.length) crs.epsg = Number(all[all.length - 1][1]);
      }
    }
    offset = data + length;
  }
  return crs;
}

/** Noms usuels des systèmes de coordonnées les plus fréquents en France. */
export function crsLabel(crs) {
  if (!crs?.epsg) return crs?.wkt ? 'Système défini (WKT)' : 'Système non défini';
  const known = {
    2154: 'RGF93 / Lambert-93',
    4326: 'WGS 84 (degrés)',
    4171: 'RGF93 (degrés)',
    3857: 'Web Mercator',
    5490: 'RGAF09 / UTM 20N (Antilles)',
    2975: 'RGR92 / UTM 40S (La Réunion)',
    32631: 'WGS 84 / UTM 31N',
    32630: 'WGS 84 / UTM 30N',
    32632: 'WGS 84 / UTM 32N',
  };
  return `${known[crs.epsg] || 'EPSG'} (EPSG:${crs.epsg})`;
}

/**
 * Lecteur de point pour un en-tête donné. La fonction renvoyée lit l'enregistrement situé à `byteOffset`
 * dans `view` et remplit `out` : x, y, z (coordonnées réelles), intensity, returnNumber, numberOfReturns,
 * classification, r, g, b (0 si absent, valeurs brutes 16 bits).
 */
export function createPointReader(header) {
  const fmt = POINT_FORMATS[header.pointFormat];
  const [sx, sy, sz] = header.scale;
  const [ox, oy, oz] = header.offset;
  const rgb = fmt.rgb;
  if (fmt.extended) {
    return (view, o, out) => {
      out.x = view.getInt32(o, true) * sx + ox;
      out.y = view.getInt32(o + 4, true) * sy + oy;
      out.z = view.getInt32(o + 8, true) * sz + oz;
      out.intensity = view.getUint16(o + 12, true);
      const returns = view.getUint8(o + 14);
      out.returnNumber = returns & 0x0f;
      out.numberOfReturns = returns >> 4;
      out.classification = view.getUint8(o + 16);
      if (rgb >= 0) {
        out.r = view.getUint16(o + rgb, true);
        out.g = view.getUint16(o + rgb + 2, true);
        out.b = view.getUint16(o + rgb + 4, true);
      } else {
        out.r = out.g = out.b = 0;
      }
      return out;
    };
  }
  return (view, o, out) => {
    out.x = view.getInt32(o, true) * sx + ox;
    out.y = view.getInt32(o + 4, true) * sy + oy;
    out.z = view.getInt32(o + 8, true) * sz + oz;
    out.intensity = view.getUint16(o + 12, true);
    const returns = view.getUint8(o + 14);
    out.returnNumber = returns & 0x07;
    out.numberOfReturns = (returns >> 3) & 0x07;
    out.classification = view.getUint8(o + 15) & 0x1f; // bits 5 à 7 : drapeaux (synthétique, clé, retenu)
    if (rgb >= 0) {
      out.r = view.getUint16(o + rgb, true);
      out.g = view.getUint16(o + rgb + 2, true);
      out.b = view.getUint16(o + rgb + 4, true);
    } else {
      out.r = out.g = out.b = 0;
    }
    return out;
  };
}

/**
 * Écrit un fichier LAS 1.2 non compressé (format 2 : couleurs) ou 0. Sert aux tests et à exporter une sélection.
 * @param points  [{ x, y, z, intensity, returnNumber, numberOfReturns, classification, r, g, b }]
 */
export function writeLas(points, { pointFormat = 2, scale = [0.01, 0.01, 0.01], epsg = null } = {}) {
  if (pointFormat !== 0 && pointFormat !== 2) throw new Error('writeLas : formats 0 et 2 seulement.');
  const recordLength = POINT_FORMATS[pointFormat].size;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    min[0] = Math.min(min[0], p.x); min[1] = Math.min(min[1], p.y); min[2] = Math.min(min[2], p.z);
    max[0] = Math.max(max[0], p.x); max[1] = Math.max(max[1], p.y); max[2] = Math.max(max[2], p.z);
  }
  if (!points.length) { min.fill(0); max.fill(0); }
  const offset = min.map((m) => Math.floor(m));

  // VLR GeoKeyDirectory minimal (une seule clé : système projeté).
  const vlr = epsg ? 54 + 16 : 0;
  const headerSize = 227;
  const dataOffset = headerSize + vlr;
  const buffer = new ArrayBuffer(dataOffset + points.length * recordLength);
  const view = new DataView(buffer);
  'LASF'.split('').forEach((c, i) => view.setUint8(i, c.charCodeAt(0)));
  view.setUint8(24, 1);
  view.setUint8(25, 2);
  'Gobai LiDAR'.split('').forEach((c, i) => view.setUint8(26 + i, c.charCodeAt(0)));
  'Gobai LiDAR'.split('').forEach((c, i) => view.setUint8(58 + i, c.charCodeAt(0)));
  view.setUint16(94, headerSize, true);
  view.setUint32(96, dataOffset, true);
  view.setUint32(100, epsg ? 1 : 0, true);
  view.setUint8(104, pointFormat);
  view.setUint16(105, recordLength, true);
  view.setUint32(107, points.length, true);
  scale.forEach((s, i) => view.setFloat64(131 + i * 8, s, true));
  offset.forEach((o, i) => view.setFloat64(155 + i * 8, o, true));
  view.setFloat64(179, max[0], true); view.setFloat64(187, min[0], true);
  view.setFloat64(195, max[1], true); view.setFloat64(203, min[1], true);
  view.setFloat64(211, max[2], true); view.setFloat64(219, min[2], true);

  if (epsg) {
    let o = headerSize;
    'LASF_Projection'.split('').forEach((c, i) => view.setUint8(o + 2 + i, c.charCodeAt(0)));
    view.setUint16(o + 18, 34735, true);
    view.setUint16(o + 20, 16, true);
    o += 54;
    [1, 1, 0, 1, 3072, 0, 1, epsg].forEach((v, i) => view.setUint16(o + i * 2, v, true));
  }

  points.forEach((p, i) => {
    const o = dataOffset + i * recordLength;
    view.setInt32(o, Math.round((p.x - offset[0]) / scale[0]), true);
    view.setInt32(o + 4, Math.round((p.y - offset[1]) / scale[1]), true);
    view.setInt32(o + 8, Math.round((p.z - offset[2]) / scale[2]), true);
    view.setUint16(o + 12, p.intensity ?? 0, true);
    view.setUint8(o + 14, ((p.returnNumber ?? 1) & 7) | (((p.numberOfReturns ?? 1) & 7) << 3));
    view.setUint8(o + 15, (p.classification ?? 1) & 0x1f);
    if (pointFormat === 2) {
      view.setUint16(o + 20, p.r ?? 0, true);
      view.setUint16(o + 22, p.g ?? 0, true);
      view.setUint16(o + 24, p.b ?? 0, true);
    }
  });
  return buffer;
}
