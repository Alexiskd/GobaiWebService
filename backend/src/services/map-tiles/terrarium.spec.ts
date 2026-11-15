// Tests de la lecture des TIFF flottants, de l'écriture Terrarium PNG et du découpage du relief lunaire.
import { deflateSync, inflateSync } from 'node:zlib';
import { cleanMoonHeights, moonReliefExportUrl, moonTileBounds, moonTileCount, moonVerticalStep } from './moon-relief.service';
import { buildMoonMesh, meshToGlb, MOON_RADIUS_KM, sampleMosaic } from './moon-relief-model';
import { crc32, decodeFloat32Tiff, decodeTerrariumPng, encodeTerrariumPng, terrariumMeters } from './terrarium';

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

describe('préchargement et modèle 3D du relief lunaire', () => {
  it('compte les tuiles des niveaux 0 à z (2, 10, …, 2 730 au niveau 5)', () => {
    expect(moonTileCount(0)).toBe(2);
    expect(moonTileCount(1)).toBe(10);
    expect(moonTileCount(5)).toBe(2730);
  });
  it('relit une tuile Terrarium enregistrée (aller-retour PNG)', () => {
    const g = decodeTerrariumPng(encodeTerrariumPng({ width: 3, height: 1, data: Float32Array.from([-9100.5, 0, Number.NaN]) }, 0.25));
    expect(Array.from(g.data).map((v) => (Number.isNaN(v) ? 'NaN' : v))).toEqual([-9100.5, 0, 'NaN']);
  });
  it('échantillonne la mosaïque et construit une sphère en relief tournée vers l’extérieur', () => {
    const W = 64, H = 32, data = new Float32Array(W * H).fill(1000);
    const mosaic = { width: W, height: H, data };
    expect(sampleMosaic(mosaic, 10, 20)).toBeCloseTo(1000);
    const mesh = buildMoonMesh(mosaic, 36, 18, 1);
    expect(mesh.positions.length).toBe(37 * 19 * 3);
    expect(mesh.indices.length).toBe(36 * 18 * 6);
    // Sommet de l'équateur, longitude 0 : rayon + 1 km, sur +X.
    const k = 9 * 37 + 18;
    expect(mesh.positions[k * 3]).toBeCloseTo(MOON_RADIUS_KM + 1, 3);
    // Toutes les normales pointent vers l'extérieur.
    for (let v = 0; v < mesh.positions.length; v += 3) {
      expect(mesh.normals[v] * mesh.positions[v] + mesh.normals[v + 1] * mesh.positions[v + 1] + mesh.normals[v + 2] * mesh.positions[v + 2]).toBeGreaterThan(0);
    }
  });
  it('écrit un glTF binaire valide (en-tête, longueur, JSON, accesseurs)', () => {
    const mesh = buildMoonMesh({ width: 8, height: 4, data: new Float32Array(32) }, 8, 4, 1);
    const glb = meshToGlb(mesh);
    expect(glb.toString('latin1', 0, 4)).toBe('glTF');
    expect(glb.readUInt32LE(4)).toBe(2);
    expect(glb.readUInt32LE(8)).toBe(glb.length);
    const json = JSON.parse(glb.toString('utf8', 20, 20 + glb.readUInt32LE(12)));
    expect(json.accessors[0].count).toBe(9 * 5);
    expect(json.accessors[3].count).toBe(8 * 4 * 6);
  });
});
