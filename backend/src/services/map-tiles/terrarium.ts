// Outils du relief en tuiles Terrarium, sans dépendance : lecture d'un GeoTIFF d'altitudes en flottants 32 bits
// (tel que le renvoie un ImageServer ArcGIS) et écriture d'une tuile Terrarium en PNG.
// Format Terrarium (Mapzen, repris par Mapterhorn) : altitude (m) = R × 256 + G + B / 256 − 32768.
// Compression zlib de Node, pour le PNG et les TIFF compressés en Deflate.
import { deflateSync, inflateSync } from 'node:zlib';

/** Altitude écrite pour un pixel sans donnée : le minimum du format, lu à 0 par le moteur. */
export const TERRARIUM_NODATA = -32768;

/** Grille d'altitudes décodée : largeur, hauteur et valeurs ligne par ligne, du nord au sud. */
export interface HeightGrid { width: number; height: number; data: Float32Array }

// ---------------------------------------------------------------- lecture TIFF

// Numéros des étiquettes TIFF lues.
const TAG = {
  width: 256, height: 257, bitsPerSample: 258, compression: 259, stripOffsets: 273, samplesPerPixel: 277,
  rowsPerStrip: 278, stripByteCounts: 279, planar: 284, predictor: 317, tileWidth: 322, tileLength: 323,
  tileOffsets: 324, tileByteCounts: 325, sampleFormat: 339,
} as const;

/** Lit les entrées de la première IFD d'un TIFF classique (pas BigTIFF) : étiquette → liste de valeurs. */
function readIfd(buf: Buffer, le: boolean): Map<number, number[]> {
  // Lecteurs selon l'ordre des octets.
  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  // Position de la première IFD et nombre d'entrées.
  const ifd = u32(4);
  const count = u16(ifd);
  // Taille d'une valeur selon son type : BYTE 1, SHORT 2, LONG 4.
  const size: Record<number, number> = { 1: 1, 3: 2, 4: 4 };
  // Étiquettes lues.
  const tags = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    // Entrée de 12 octets : étiquette, type, nombre de valeurs, valeurs (ou leur position si plus de 4 octets).
    const e = ifd + 2 + i * 12;
    const tag = u16(e), type = u16(e + 2), n = u32(e + 4);
    // Types non lus (rationnels, doubles, ASCII…) : ignorés, aucune étiquette utile ici n'en a.
    const s = size[type];
    if (!s) continue;
    // Valeurs dans l'entrée si elles tiennent en 4 octets, sinon à la position donnée.
    const at = s * n <= 4 ? e + 8 : u32(e + 8);
    const values: number[] = [];
    for (let k = 0; k < n; k++) values.push(s === 1 ? buf[at + k] : s === 2 ? u16(at + k * 2) : u32(at + k * 4));
    tags.set(tag, values);
  }
  return tags;
}

/** Décompresse un bloc LZW au sens TIFF (codes de 9 à 12 bits, poids fort d'abord, changement anticipé). */
export function lzwDecode(input: Buffer): Buffer {
  // Sortie, agrandie au besoin.
  let out: Buffer = Buffer.alloc(Math.max(1024, input.length * 4));
  let len = 0;
  const push = (bytes: Buffer) => {
    if (len + bytes.length > out.length) { const bigger = Buffer.alloc(Math.max(out.length * 2, len + bytes.length)); out.copy(bigger, 0, 0, len); out = bigger; }
    bytes.copy(out, len); len += bytes.length;
  };
  // Dictionnaire : 256 octets, puis CLEAR (256) et EOI (257).
  let dict: Buffer[] = [];
  const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict.push(Buffer.from([i])); dict.push(Buffer.alloc(0), Buffer.alloc(0)); };
  reset();
  let width = 9, bitPos = 0, prev: Buffer | null = null;
  const totalBits = input.length * 8;
  while (bitPos + width <= totalBits) {
    // Lit `width` bits, poids fort d'abord.
    let code = 0;
    for (let b = 0; b < width; b++) { const p = bitPos + b; code = (code << 1) | ((input[p >> 3] >> (7 - (p & 7))) & 1); }
    bitPos += width;
    // CLEAR : dictionnaire et largeur remis à zéro.
    if (code === 256) { reset(); width = 9; prev = null; continue; }
    // EOI : fin des données.
    if (code === 257) break;
    // Chaîne du code : connue, ou cas particulier « précédent + son premier octet ».
    let entry: Buffer;
    if (code < dict.length) entry = dict[code];
    else if (prev) entry = Buffer.concat([prev, prev.subarray(0, 1)]);
    else throw new Error('LZW : code invalide');
    push(entry);
    // Nouvelle entrée du dictionnaire, puis élargissement anticipé des codes (TIFF).
    if (prev) dict.push(Buffer.concat([prev, entry.subarray(0, 1)]));
    prev = entry;
    if (dict.length + 1 >= 1 << width && width < 12) width++;
  }
  return out.subarray(0, len);
}

/** Annule le prédicteur flottant TIFF (3) d'une ligne : différences horizontales sur les octets, puis plans d'octets. */
function undoFloatPredictor(row: Buffer, width: number, bytes: number): Buffer {
  // Somme cumulée des octets (la différence porte sur toute la ligne, échantillon par échantillon).
  for (let i = 1; i < row.length; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
  // Les octets sont rangés par plans, poids fort d'abord : le résultat est en gros-boutiste.
  const out = Buffer.alloc(row.length);
  for (let i = 0; i < width; i++) for (let b = 0; b < bytes; b++) out[i * bytes + b] = row[b * width + i];
  return out;
}

/**
 * Décode un TIFF d'une bande en flottants 32 bits : bandes ou tuiles, sans compression, LZW ou Deflate, avec ou
 * sans prédicteur flottant. Renvoie la grille, ligne par ligne du haut vers le bas.
 */
export function decodeFloat32Tiff(buf: Buffer): HeightGrid {
  // Ordre des octets : « II » petit-boutiste, « MM » gros-boutiste ; nombre magique 42 (TIFF classique).
  const order = buf.toString('latin1', 0, 2);
  if (order !== 'II' && order !== 'MM') throw new Error('TIFF : en-tête invalide');
  const le = order === 'II';
  if ((le ? buf.readUInt16LE(2) : buf.readUInt16BE(2)) !== 42) throw new Error('TIFF : seul le TIFF classique est lu (pas BigTIFF)');
  const tags = readIfd(buf, le);
  const one = (t: number, d?: number) => tags.get(t)?.[0] ?? d;
  // Dimensions et format des échantillons.
  const width = one(TAG.width)!, height = one(TAG.height)!;
  const bits = one(TAG.bitsPerSample, 1)!, format = one(TAG.sampleFormat, 1)!, spp = one(TAG.samplesPerPixel, 1)!;
  if (!width || !height) throw new Error('TIFF : dimensions absentes');
  if (bits !== 32 || format !== 3 || spp !== 1) throw new Error(`TIFF : flottants 32 bits sur une bande attendus (bits ${bits}, format ${format}, bandes ${spp})`);
  const compression = one(TAG.compression, 1)!, predictor = one(TAG.predictor, 1)!;
  if (![1, 5, 8, 32946].includes(compression)) throw new Error(`TIFF : compression ${compression} non prise en charge`);
  if (predictor !== 1 && predictor !== 3) throw new Error(`TIFF : prédicteur ${predictor} non pris en charge`);
  // Décompression d'un bloc.
  const inflate = (b: Buffer) => (compression === 1 ? b : compression === 5 ? lzwDecode(b) : inflateSync(b));
  const data = new Float32Array(width * height);
  // Lecture d'une ligne de `w` flottants d'un bloc vers la grille, colonne de départ `x0`, ligne `y`.
  const readRow = (block: Buffer, offset: number, w: number, x0: number, y: number) => {
    if (y >= height) return;
    let row: Buffer = Buffer.from(block.subarray(offset, offset + w * 4));
    if (row.length < w * 4) return;
    let rowLe = le;
    if (predictor === 3) { row = undoFloatPredictor(row, w, 4); rowLe = false; }
    for (let i = 0; i < w && x0 + i < width; i++) data[y * width + x0 + i] = rowLe ? row.readFloatLE(i * 4) : row.readFloatBE(i * 4);
  };
  const tileW = one(TAG.tileWidth), tileH = one(TAG.tileLength);
  if (tileW && tileH) {
    // Image en tuiles : de gauche à droite, puis de haut en bas.
    const offsets = tags.get(TAG.tileOffsets) ?? [], counts = tags.get(TAG.tileByteCounts) ?? [];
    const across = Math.ceil(width / tileW);
    offsets.forEach((off, t) => {
      const block = inflate(buf.subarray(off, off + counts[t]));
      const tx = (t % across) * tileW, ty = Math.floor(t / across) * tileH;
      for (let r = 0; r < tileH; r++) readRow(block, r * tileW * 4, tileW, tx, ty + r);
    });
  } else {
    // Image en bandes de `rowsPerStrip` lignes.
    const offsets = tags.get(TAG.stripOffsets) ?? [], counts = tags.get(TAG.stripByteCounts) ?? [];
    const rps = one(TAG.rowsPerStrip, height)!;
    offsets.forEach((off, s) => {
      const block = inflate(buf.subarray(off, off + counts[s]));
      for (let r = 0; r < rps; r++) readRow(block, r * width * 4, width, 0, s * rps + r);
    });
  }
  return { width, height, data };
}

// ---------------------------------------------------------------- écriture Terrarium PNG

// Table du CRC-32 des blocs PNG.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();

/** CRC-32 d'un bloc (type + données), comme l'exige le PNG. */
export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Bloc PNG : longueur, type, données, CRC. */
function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** PNG RVB 8 bits sans perte, à partir des pixels bruts (3 octets par pixel, ligne par ligne). */
export function encodeRgbPng(rgb: Buffer, width: number, height: number): Buffer {
  // En-tête : largeur, hauteur, 8 bits, couleur RVB (2), compression, filtre et entrelacement standard.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Lignes précédées du filtre « Sub » (1) : les altitudes voisines sont proches, le PNG est plus léger.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1), s = y * stride;
    raw[o] = 1;
    for (let i = 0; i < stride; i++) raw[o + 1 + i] = (rgb[s + i] - (i >= 3 ? rgb[s + i - 3] : 0)) & 0xff;
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/**
 * Tuile Terrarium en PNG à partir d'altitudes en mètres. `step` : pas vertical d'arrondi en mètres (comme Mapterhorn,
 * qui arrondit la précision selon le zoom pour alléger les tuiles), 1/256 au plus fin. Pixel sans donnée (non fini) :
 * TERRARIUM_NODATA.
 */
export function encodeTerrariumPng(grid: HeightGrid, step = 1 / 256): Buffer {
  const { width, height, data } = grid;
  const rgb = Buffer.alloc(width * height * 3);
  const q = Math.max(1 / 256, step);
  for (let i = 0; i < width * height; i++) {
    const m = data[i];
    // Altitude arrondie au pas, bornée au format, décalée de 32 768.
    const h = Number.isFinite(m) ? Math.round(m / q) * q : TERRARIUM_NODATA;
    const v = Math.min(65535.99, Math.max(0, h + 32768));
    rgb[i * 3] = Math.floor(v / 256);
    rgb[i * 3 + 1] = Math.floor(v) % 256;
    rgb[i * 3 + 2] = Math.floor((v - Math.floor(v)) * 256);
  }
  return encodeRgbPng(rgb, width, height);
}

/** Altitude Terrarium d'un pixel (pour les tests et les vérifications). */
export const terrariumMeters = (r: number, g: number, b: number): number => r * 256 + g + b / 256 - 32768;

/**
 * Relit un PNG RVB 8 bits écrit par encodeRgbPng (filtres « aucun » et « Sub » seulement) : pixels bruts,
 * 3 octets par pixel. Sert à rassembler les tuiles gardées en base.
 */
export function decodeRgbPng(png: Buffer): { width: number; height: number; rgb: Buffer } {
  if (png.readUInt32BE(0) !== 0x89504e47) throw new Error('PNG : signature invalide');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (png[24] !== 8 || png[25] !== 2 || png[28] !== 0) throw new Error('PNG : RVB 8 bits non entrelacé attendu');
  // Blocs IDAT mis bout à bout.
  const idat: Buffer[] = [];
  for (let o = 8; o + 8 <= png.length;) {
    const len = png.readUInt32BE(o), type = png.toString('latin1', o + 4, o + 8);
    if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    if (type === 'IEND') break;
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3, rgb = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    if (f !== 0 && f !== 1) throw new Error(`PNG : filtre ${f} non pris en charge`);
    for (let i = 0; i < stride; i++) rgb[dst + i] = (raw[src + i] + (f === 1 && i >= 3 ? rgb[dst + i - 3] : 0)) & 0xff;
  }
  return { width, height, rgb };
}

/** Altitudes (m) d'une tuile Terrarium PNG écrite par encodeTerrariumPng ; pixel sans donnée → NaN. */
export function decodeTerrariumPng(png: Buffer): HeightGrid {
  const { width, height, rgb } = decodeRgbPng(png);
  const data = new Float32Array(width * height);
  for (let i = 0; i < data.length; i++) {
    const m = terrariumMeters(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]);
    data[i] = m <= TERRARIUM_NODATA ? Number.NaN : m;
  }
  return { width, height, data };
}
