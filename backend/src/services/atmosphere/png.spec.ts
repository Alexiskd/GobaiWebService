// Compression zlib (fabrication des images d'essai).
import { deflateSync } from 'zlib';
// Fonctions testées.
import { decodePng, encodePngRgb } from './png';

// Signature PNG.
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

// crc : contrôle CRC-32 (même algorithme que le format).
function crc(bytes: Buffer): number {
  // Valeur de départ.
  let c = 0xffffffff;
  // Octet par octet, bit par bit.
  for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; }
  // Valeur finale.
  return (c ^ 0xffffffff) >>> 0;
// Fin de crc.
}

// block : un bloc PNG.
function block(type: string, data: Buffer): Buffer {
  // Nom et données.
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  // Longueur et contrôle.
  const len = Buffer.alloc(4), sum = Buffer.alloc(4); len.writeUInt32BE(data.length); sum.writeUInt32BE(crc(body));
  // Bloc.
  return Buffer.concat([len, body, sum]);
// Fin de block.
}

// filterRow : applique le filtre `f` à une ligne (octets bruts), connaissant la ligne précédente et les octets par pixel.
function filterRow(row: number[], prev: number[] | null, f: number, bpp: number): number[] {
  // Octet par octet.
  return row.map((x, i) => {
    // Voisins : gauche, haut, haut-gauche.
    const a = i >= bpp ? row[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
    // Prédicteur de Paeth.
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c), pae = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    // Octet filtré selon le type.
    return (x - [0, a, b, (a + b) >> 1, pae][f]) & 0xff;
  // Fin du parcours.
  });
// Fin de filterRow.
}

// makePng : image d'essai (lignes brutes, un filtre par ligne, blocs supplémentaires, entrelacement).
function makePng(w: number, h: number, color: number, depth: number, rows: number[][], filters: number[], extra: Buffer[] = [], interlace = 0): Buffer {
  // Octets par pixel pour les filtres.
  const bpp = Math.max(1, ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[color] * depth >> 3);
  // Lignes filtrées, précédées de leur type.
  const raw = Buffer.from(rows.flatMap((r, y) => [filters[y % filters.length], ...filterRow(r, y ? rows[y - 1] : null, filters[y % filters.length], bpp)]));
  // En-tête.
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = depth; ihdr[9] = color; ihdr[12] = interlace;
  // Fichier complet.
  return Buffer.concat([SIG, block('IHDR', ihdr), ...extra, block('IDAT', deflateSync(raw)), block('IEND', Buffer.alloc(0))]);
// Fin de makePng.
}

// Groupe de tests : le format PNG.
describe('PNG : lecture et écriture', () => {
  // Test : aller-retour RVB.
  it('relit à l’identique une image RVB encodée (filtre « haut »), opaque', () => {
    // Pixels 3 × 2 variés.
    const rgb = new Uint8Array([0, 1, 2, 250, 251, 252, 9, 8, 7, 0, 0, 0, 255, 255, 255, 12, 200, 99]);
    // Aller-retour.
    const d = decodePng(encodePngRgb(3, 2, rgb));
    // Dimensions.
    expect([d.width, d.height]).toEqual([3, 2]);
    // Couleurs identiques, alpha opaque.
    expect(Array.from(d.rgba)).toEqual([0, 1, 2, 255, 250, 251, 252, 255, 9, 8, 7, 255, 0, 0, 0, 255, 255, 255, 255, 255, 12, 200, 99, 255]);
  // Fin du test.
  });

  // Test : RVBA et les cinq filtres.
  it('défiltre les cinq filtres (aucun, gauche, haut, moyenne, Paeth) en RVBA 8 bits', () => {
    // Cinq lignes de 3 pixels RVBA.
    const rows = Array.from({ length: 5 }, (_, y) => Array.from({ length: 12 }, (_, i) => (y * 37 + i * 23 + ((i * y) % 7) * 11) & 0xff));
    // Une ligne par filtre.
    const d = decodePng(makePng(3, 5, 6, 8, rows, [0, 1, 2, 3, 4]));
    // Pixels identiques aux lignes brutes.
    expect(Array.from(d.rgba)).toEqual(rows.flat());
  // Fin du test.
  });

  // Test : palette avec transparence.
  it('lit une image à palette (8 bits et 4 bits) avec transparence par entrée', () => {
    // Palette : rouge, vert, bleu.
    const plte = block('PLTE', Buffer.from([255, 0, 0, 0, 255, 0, 0, 0, 255]));
    // Transparence : rouge transparent, vert à moitié ; bleu opaque (au-delà de tRNS).
    const trns = block('tRNS', Buffer.from([0, 128]));
    // 8 bits : indices 0, 1, 2.
    const d8 = decodePng(makePng(3, 1, 3, 8, [[0, 1, 2]], [0], [plte, trns]));
    // Couleurs et alphas.
    expect(Array.from(d8.rgba)).toEqual([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255]);
    // 4 bits : indices 2 et 1 dans un octet, puis 0.
    const d4 = decodePng(makePng(3, 1, 3, 4, [[0x21, 0x00]], [0], [plte, trns]));
    // Couleurs et alphas.
    expect(Array.from(d4.rgba)).toEqual([0, 0, 255, 255, 0, 255, 0, 128, 255, 0, 0, 0]);
  // Fin du test.
  });

  // Test : refus explicites.
  it('refuse un fichier sans signature et une image entrelacée', () => {
    // Sans signature.
    expect(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]))).toThrow();
    // Entrelacée.
    expect(() => decodePng(makePng(1, 1, 2, 8, [[1, 2, 3]], [0], [], 1))).toThrow();
  // Fin du test.
  });
// Fin du groupe.
});
