// Décompression et compression zlib de Node (format des données d'image PNG).
import { deflateSync, inflateSync } from 'zlib';

// Lecture et écriture minimales du format PNG, sans dépendance : le moteur des précipitations lit les tuiles radar
// (couleurs exactes, sans lissage) pour retrouver la réflectivité de chaque pixel, puis renvoie au navigateur une image
// RVB où chaque canal porte une valeur mesurée (pluie, neige, couverture radar) au lieu d'une couleur.

/** Image décodée : largeur, hauteur et pixels RVBA sur 8 bits (4 octets par pixel, ligne par ligne, du haut). */
// Forme de l'image décodée.
export interface DecodedPng {
  // width : la largeur, en pixels.
  width: number;
  // height : la hauteur, en pixels.
  height: number;
  // rgba : les pixels, 4 octets chacun.
  rgba: Uint8Array;
// Fin de DecodedPng.
}

// Signature des fichiers PNG (8 octets).
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// Taille maximale acceptée : 4 096 × 4 096 pixels (protège la mémoire du serveur).
const MAX_PIXELS = 4096 * 4096;
// Nombre de canaux par type de couleur : 0 gris, 2 RVB, 3 palette, 4 gris et alpha, 6 RVBA.
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

// Table du contrôle CRC-32 des blocs PNG, calculée une fois.
const CRC_TABLE = (() => {
  // 256 entrées.
  const t = new Uint32Array(256);
  // Pour chaque octet possible :
  for (let n = 0; n < 256; n++) {
    // valeur de départ ;
    let c = n;
    // huit décalages, avec le polynôme du PNG ;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    // gardée.
    t[n] = c >>> 0;
  // Fin du parcours.
  }
  // Renvoie la table.
  return t;
// Fin du calcul.
})();

// crc32 : contrôle CRC-32 d'une suite d'octets.
function crc32(bytes: Uint8Array): number {
  // Valeur de départ.
  let c = 0xffffffff;
  // Octet par octet.
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  // Valeur finale.
  return (c ^ 0xffffffff) >>> 0;
// Fin de crc32.
}

// paeth : prédicteur du filtre Paeth (gauche a, haut b, haut-gauche c).
function paeth(a: number, b: number, c: number): number {
  // Estimation.
  const p = a + b - c;
  // Écarts à chacun.
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  // Le plus proche, dans l'ordre a, b, c.
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
// Fin de paeth.
}

/**
 * Décode une image PNG non entrelacée (types de couleur 0, 2, 3, 4 et 6 ; profondeurs 1 à 8 pour le gris et la
 * palette, 8 ou 16 pour les autres). Lève une erreur explicite si le fichier est illisible ou non pris en charge.
 */
// Déclare et exporte decodePng : les octets du fichier.
export function decodePng(file: Uint8Array): DecodedPng {
  // Vue Buffer sur les octets (lecture des entiers sur 4 octets).
  const buf = Buffer.from(file.buffer, file.byteOffset, file.byteLength);
  // Signature absente : erreur.
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('PNG : signature absente');
  // En-tête : largeur, hauteur, profondeur, type de couleur, entrelacement.
  let width = 0, height = 0, depth = 0, color = -1, interlace = 0;
  // Palette (RVB) et transparence (alpha par entrée, ou couleur transparente).
  let palette: Uint8Array | null = null, trns: Uint8Array | null = null;
  // Blocs de données d'image, dans l'ordre.
  const idat: Buffer[] = [];
  // Position de lecture, après la signature.
  let pos = 8;
  // Bloc par bloc, jusqu'à la fin (début de la boucle).
  while (pos + 12 <= buf.length) {
    // Longueur des données du bloc.
    const len = buf.readUInt32BE(pos);
    // Nom du bloc (4 lettres).
    const type = buf.toString('latin1', pos + 4, pos + 8);
    // Bloc tronqué : erreur.
    if (pos + 12 + len > buf.length) throw new Error(`PNG : bloc ${type} tronqué`);
    // Données du bloc.
    const data = buf.subarray(pos + 8, pos + 8 + len);
    // En-tête : dimensions et format.
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; color = data[9]; interlace = data[12]; }
    // Palette.
    else if (type === 'PLTE') palette = new Uint8Array(data);
    // Transparence.
    else if (type === 'tRNS') trns = new Uint8Array(data);
    // Données d'image.
    else if (type === 'IDAT') idat.push(data);
    // Fin d'image : arrêt.
    else if (type === 'IEND') break;
    // Bloc suivant (données et contrôle de 4 octets).
    pos += 12 + len;
  // Fin de la boucle.
  }
  // Nombre de canaux du type de couleur.
  const channels = CHANNELS[color];
  // En-tête absent ou format inconnu : erreur.
  if (!width || !height || !channels) throw new Error('PNG : en-tête absent ou type de couleur inconnu');
  // Image trop grande : erreur.
  if (width * height > MAX_PIXELS) throw new Error('PNG : image trop grande');
  // Entrelacement (Adam7) : non pris en charge.
  if (interlace !== 0) throw new Error('PNG : image entrelacée non prise en charge');
  // Profondeurs permises : 1, 2, 4, 8 pour le gris et la palette ; 8 ou 16 pour les autres (16 interdit en palette).
  const okDepth = color === 0 || color === 3 ? [1, 2, 4, 8, 16].includes(depth) && !(color === 3 && depth === 16) : depth === 8 || depth === 16;
  // Profondeur non permise : erreur.
  if (!okDepth) throw new Error(`PNG : profondeur ${depth} non prise en charge pour le type ${color}`);
  // Palette absente pour une image à palette : erreur.
  if (color === 3 && !palette) throw new Error('PNG : palette absente');
  // Bits par pixel.
  const bitsPerPixel = channels * depth;
  // Octets par pixel pour les filtres (au moins 1).
  const bpp = Math.max(1, bitsPerPixel >> 3);
  // Octets par ligne (sans l'octet du filtre).
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  // Données décompressées.
  const raw = inflateSync(Buffer.concat(idat));
  // Taille insuffisante : erreur.
  if (raw.length < height * (stride + 1)) throw new Error('PNG : données d’image incomplètes');
  // Lignes défiltrées, bout à bout.
  const lines = new Uint8Array(height * stride);
  // Ligne par ligne (début de la boucle).
  for (let y = 0; y < height; y++) {
    // Type de filtre de la ligne.
    const f = raw[y * (stride + 1)];
    // Filtre inconnu : erreur.
    if (f > 4) throw new Error(`PNG : filtre ${f} inconnu`);
    // Début de la ligne filtrée, dans les données décompressées.
    const src = y * (stride + 1) + 1;
    // Début de la ligne défiltrée, et de la ligne précédente.
    const dst = y * stride, up = dst - stride;
    // Octet par octet (début).
    for (let i = 0; i < stride; i++) {
      // Voisins : gauche, haut, haut-gauche (0 hors de l'image).
      const a = i >= bpp ? lines[dst + i - bpp] : 0, b = y ? lines[up + i] : 0, c = y && i >= bpp ? lines[up + i - bpp] : 0;
      // Octet filtré.
      const x = raw[src + i];
      // Défiltrage selon le type : aucun, gauche, haut, moyenne, Paeth.
      lines[dst + i] = (f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
    // Fin des octets.
    }
  // Fin des lignes.
  }
  // Pixels RVBA.
  const rgba = new Uint8Array(width * height * 4);
  // sample : valeur du canal k du pixel x de la ligne y, ramenée sur 8 bits (début).
  const sample = (y: number, x: number, k: number): number => {
    // Profondeur 8 : l'octet.
    if (depth === 8) return lines[y * stride + x * channels + k];
    // Profondeur 16 : l'octet de poids fort.
    if (depth === 16) return lines[y * stride + (x * channels + k) * 2];
    // Profondeurs 1, 2, 4 (un seul canal) : position du bit.
    const bit = x * depth;
    // Valeur brute.
    const v = (lines[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
    // Palette : l'indice tel quel ; gris : ramené sur 8 bits.
    return color === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
  // Fin de sample.
  };
  // Couleur transparente des images grises ou RVB (tRNS sur 2 octets par canal), ou null.
  const key = trns && (color === 0 || color === 2) ? Array.from({ length: color === 0 ? 1 : 3 }, (_, k) => (depth === 16 ? trns![k * 2] : trns![k * 2 + 1])) : null;
  // Pixel par pixel (début).
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    // Position du pixel dans le résultat.
    const o = (y * width + x) * 4;
    // Palette : couleur de l'entrée, alpha de tRNS (opaque au-delà).
    if (color === 3) { const i = sample(y, x, 0); rgba[o] = palette![i * 3] ?? 0; rgba[o + 1] = palette![i * 3 + 1] ?? 0; rgba[o + 2] = palette![i * 3 + 2] ?? 0; rgba[o + 3] = trns && i < trns.length ? trns[i] : 255; continue; }
    // Gris (avec ou sans alpha) : la même valeur sur les trois canaux.
    if (color === 0 || color === 4) { const g = sample(y, x, 0); rgba[o] = g; rgba[o + 1] = g; rgba[o + 2] = g; rgba[o + 3] = color === 4 ? sample(y, x, 1) : key && g === key[0] ? 0 : 255; continue; }
    // RVB ou RVBA : les trois couleurs.
    rgba[o] = sample(y, x, 0); rgba[o + 1] = sample(y, x, 1); rgba[o + 2] = sample(y, x, 2);
    // Alpha : le canal (RVBA), ou la couleur transparente (RVB), sinon opaque.
    rgba[o + 3] = color === 6 ? sample(y, x, 3) : key && rgba[o] === key[0] && rgba[o + 1] === key[1] && rgba[o + 2] === key[2] ? 0 : 255;
  // Fin des pixels.
  }
  // Image décodée.
  return { width, height, rgba };
// Fin de decodePng.
}

// chunk : un bloc PNG (longueur, nom, données, contrôle).
function chunk(type: string, data: Uint8Array): Buffer {
  // Nom et données réunis (le contrôle porte sur les deux).
  const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  // Longueur, sur 4 octets.
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  // Contrôle, sur 4 octets.
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  // Bloc complet.
  return Buffer.concat([len, body, crc]);
// Fin de chunk.
}

/** Encode une image RVB sur 8 bits (3 octets par pixel, ligne par ligne, du haut) en PNG, filtre « haut » par ligne. */
// Déclare et exporte encodePngRgb : largeur, hauteur et pixels.
export function encodePngRgb(width: number, height: number, rgb: Uint8Array): Buffer {
  // Pixels en nombre insuffisant : erreur.
  if (rgb.length < width * height * 3) throw new Error('PNG : pixels en nombre insuffisant');
  // Octets par ligne.
  const stride = width * 3;
  // Lignes filtrées, chacune précédée de son type de filtre.
  const raw = Buffer.alloc(height * (stride + 1));
  // Ligne par ligne (début).
  for (let y = 0; y < height; y++) {
    // Filtre « haut » (2), sauf la première ligne (aucun).
    raw[y * (stride + 1)] = y ? 2 : 0;
    // Octet par octet : écart à la ligne du dessus (les zones uniformes deviennent des zéros, très compressibles).
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = (rgb[y * stride + i] - (y ? rgb[(y - 1) * stride + i] : 0)) & 0xff;
  // Fin des lignes.
  }
  // En-tête : dimensions, profondeur 8, type RVB, compression, filtre et entrelacement standard.
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Fichier complet : signature, en-tête, données compressées, fin.
  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', new Uint8Array(0))]);
// Fin de encodePngRgb.
}
