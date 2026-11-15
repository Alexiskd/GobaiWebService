// Tests de la lecture des TIFF flottants, de l'écriture Terrarium PNG et du découpage du relief lunaire.
import { deflateSync, inflateSync } from 'node:zlib';
import { cleanMoonHeights, moonReliefExportUrl, moonTileBounds, moonVerticalStep } from './moon-relief.service';
import { crc32, decodeFloat32Tiff, encodeTerrariumPng, terrariumMeters } from './terrarium';

/** TIFF d'une bande en flottants 32 bits, une seule bande de lignes, petit-boutiste ; Deflate et prédicteur 3 au choix. */
function makeTiff(values: number[], width: number, height: number, opts: { deflate?: boolean; predictor3?: boolean } = {}): Buffer {
  let pixels: Buffer;
  if (opts.predictor3) {
    // Prédicteur flottant : octets gros-boutistes rangés par plans, puis différences horizontales.
    const rows: Buffer[] = [];
    for (let y = 0; y < height; y++) {
      const be = Buffer.alloc(width * 4);
      for (let i = 0; i < width; i++) be.writeFloatBE(values[y * width + i], i * 4);
      const planes = Buffer.alloc(width * 4);
      for (let b = 0; b < 4; b++) for (let i = 0; i < width; i++) planes[b * width + i] = be[i * 4 + b];
      for (let i = planes.length - 1; i > 0; i--) planes[i] = (planes[i] - planes[i - 1]) & 0xff;
      rows.push(planes);
    }
    pixels = Buffer.concat(rows);
  } else {
    pixels = Buffer.alloc(values.length * 4);
    values.forEach((v, i) => pixels.writeFloatLE(v, i * 4));
  }
  const data = opts.deflate ? deflateSync(pixels) : pixels;
  const entries: [number, number, number][] = [
    [256, 4, width], [257, 4, height], [258, 3, 32], [259, 3, opts.deflate ? 8 : 1], [273, 4, 0], [277, 3, 1],
    [278, 4, height], [279, 4, data.length], [317, 3, opts.predictor3 ? 3 : 1], [339, 3, 3],
  ];
  const head = Buffer.alloc(8 + 2 + entries.length * 12 + 4);
  head.write('II', 0, 'latin1'); head.writeUInt16LE(42, 2); head.writeUInt32LE(8, 4); head.writeUInt16LE(entries.length, 8);
  entries.forEach(([tag, type, value], k) => {
    const e = 10 + k * 12;
    head.writeUInt16LE(tag, e); head.writeUInt16LE(type, e + 2); head.writeUInt32LE(1, e + 4);
    const v = tag === 273 ? head.length : value;
    if (type === 3) head.writeUInt16LE(v, e + 8); else head.writeUInt32LE(v, e + 8);
  });
  return Buffer.concat([head, data]);
}

/** Relit les pixels RVB d'un PNG écrit par encodeRgbPng (filtre Sub sur chaque ligne). */
function readRgbPng(png: Buffer): { width: number; height: number; rgb: Buffer } {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  let o = 8; const idat: Buffer[] = [];
  while (o < png.length) {
    const len = png.readUInt32BE(o), type = png.toString('latin1', o + 4, o + 8);
    if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3, rgb = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (stride + 1)]).toBe(1);
    for (let i = 0; i < stride; i++) rgb[y * stride + i] = (raw[y * (stride + 1) + 1 + i] + (i >= 3 ? rgb[y * stride + i - 3] : 0)) & 0xff;
  }
  return { width, height, rgb };
}

describe('decodeFloat32Tiff', () => {
  const W = 5, H = 3;
  const values = [0, 1.5, -9100.25, 10786, 3.75, -1, 2, 4, 8, 16, 1000, -2000, 0.5, 7, -7];
  it.each([[{}], [{ deflate: true }], [{ deflate: true, predictor3: true }]])('relit exactement les flottants (%o)', (opts) => {
    const g = decodeFloat32Tiff(makeTiff(values, W, H, opts));
    expect([g.width, g.height]).toEqual([W, H]);
    expect(Array.from(g.data)).toEqual(values.map((v) => Math.fround(v)));
  });
  it('refuse ce qui n’est pas un TIFF (réponse d’erreur JSON)', () => {
    expect(() => decodeFloat32Tiff(Buffer.from('{"error":{"code":500}}'))).toThrow('TIFF');
  });
});

describe('encodeTerrariumPng', () => {
  it('écrit un PNG valide dont les altitudes se relisent au pas près, sans donnée = −32768', () => {
    const data = Float32Array.from([0, 1234.5, -9100, Number.NaN]);
    const png = encodeTerrariumPng({ width: 2, height: 2, data }, 0.25);
    expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
    // CRC du bloc IHDR conforme.
    expect(png.readUInt32BE(29)).toBe(crc32(png.subarray(12, 29)));
    const { rgb } = readRgbPng(png);
    const h = [0, 1, 2, 3].map((i) => terrariumMeters(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]));
    expect(h).toEqual([0, 1234.5, -9100, -32768]);
  });
});

describe('relief lunaire', () => {
  it('découpe la Lune en 2^(z+1) × 2^z tuiles, du pôle Nord au pôle Sud', () => {
    expect(moonTileBounds(0, 0, 0)).toEqual([-180, -90, 0, 90]);
    expect(moonTileBounds(0, 1, 0)).toEqual([0, -90, 180, 90]);
    expect(moonTileBounds(2, 7, 3)).toEqual([135, -90, 180, -45]);
  });
  it('arrondit la précision verticale selon le niveau (1 m à 25 cm)', () => {
    expect(moonVerticalStep(0)).toBe(1);
    expect(moonVerticalStep(5)).toBe(0.5);
    expect(moonVerticalStep(8)).toBe(0.25);
  });
  it('demande des flottants 32 bits en TIFF sans compression', () => {
    const url = new URL(moonReliefExportUrl('https://exemple.test/ImageServer/', 1, 2, 0));
    expect(url.pathname).toBe('/ImageServer/exportImage');
    expect(url.searchParams.get('bbox')).toBe('0,0,90,90');
    expect(url.searchParams.get('pixelType')).toBe('F32');
    expect(url.searchParams.get('format')).toBe('tiff');
    expect(url.searchParams.get('compression')).toBe('None');
  });
  it('met hors données les valeurs aberrantes et convertit les kilomètres en mètres', () => {
    const m = cleanMoonHeights({ width: 3, height: 1, data: Float32Array.from([1, -3.4e38, 2]) });
    expect(Array.from(m.data).map((v) => (Number.isNaN(v) ? 'NaN' : v))).toEqual([1000, 'NaN', 2000]);
    const k = cleanMoonHeights({ width: 2, height: 1, data: Float32Array.from([-9100, 10786]) });
    expect(Array.from(k.data)).toEqual([-9100, 10786]);
  });
});
