import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';
import type { AppConfig } from '../../common/configuration';
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Projection stéréographique polaire
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
/**
 * Projection stéréographique polaire sphérique (mosaïques ShadowCam : centre au pôle, méridien central 0°, sphère de
 * 1 737 400 m). Snyder, « Map Projections — A Working Manual », §21. Fonctions pures, testées.
 */
export interface PolarParams { pole: 'north' | 'south'; lon0: number; k0: number; radius: number }
 
const D = Math.PI / 180;
 
export function polarToLonLat(x: number, y: number, p: PolarParams): [number, number] {
  const rho = Math.hypot(x, y);
  const c = 2 * Math.atan(rho / (2 * p.radius * p.k0));
  if (p.pole === 'south') return [wrap(p.lon0 + Math.atan2(x, y) / D), -(90 - c / D)];
  return [wrap(p.lon0 + Math.atan2(x, -y) / D), 90 - c / D];
}
 
export function lonLatToPolar(lon: number, lat: number, p: PolarParams): [number, number] {
  const t = p.pole === 'south' ? Math.tan(Math.PI / 4 + (lat * D) / 2) : Math.tan(Math.PI / 4 - (lat * D) / 2);
  const rho = 2 * p.radius * p.k0 * t;
  const a = (lon - p.lon0) * D;
  return p.pole === 'south' ? [rho * Math.sin(a), rho * Math.cos(a)] : [rho * Math.sin(a), -rho * Math.cos(a)];
}
 
const wrap = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;
 
/** Paramètres tirés des clés GeoTIFF, sinon des valeurs ShadowCam documentées (et du pôle indiqué par le nom). */
export function polarParamsFromKeys(keys: Record<number, number | string>, poleHint: 'north' | 'south'): PolarParams {
  const n = (k: number) => (typeof keys[k] === 'number' ? (keys[k] as number) : undefined);
  const latOrigin = n(3081) ?? n(3089);           // ProjNatOriginLat / ProjCenterLat
  const stdParallel = n(3078);                     // ProjStdParallel1 (variante B)
  const lon0 = n(3095) ?? n(3080) ?? n(3088) ?? 0; // pôle vertical / origine / centre
  const radius = n(2057) ?? 1737400;               // demi-grand axe de l'ellipsoïde (sphère lunaire)
  let k0 = n(3092) ?? 1;
  if (stdParallel !== undefined && Math.abs(stdParallel) < 90) k0 = (1 + Math.sin(Math.abs(stdParallel) * D)) / 2;
  const ref = latOrigin ?? stdParallel;
  const pole = ref !== undefined && ref !== 0 ? (ref < 0 ? 'south' : 'north') : poleHint;
  return { pole, lon0, k0, radius };
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Encodeur PNG (gris + alpha)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
const crc32 = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
 
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
 
/** PNG gris + alpha (8 bits) : `ga` = [g0, a0, g1, a1, …], lisible directement par le navigateur. */
export function encodeGrayAlphaPng(width: number, height: number, ga: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8 bits, gris + alpha
  const raw = Buffer.alloc((width * 2 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 2 + 1)] = 0; // pas de filtre
    Buffer.from(ga.buffer, ga.byteOffset + y * width * 2, width * 2).copy(raw, y * (width * 2 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 6 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Lecteur GeoTIFF
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
/**
 * Lecteur GeoTIFF minimal (sans dépendance), suffisant pour les mosaïques ShadowCam de Danuri publiées au PDS :
 * TIFF classique, petit ou grand boutiste, bandes ou tuiles (COG), compressions aucune / LZW / Deflate, prédicteurs
 * 1, 2 (horizontal) et 3 (flottant), une seule bande en entier 8/16/32 bits ou flottant 32/64 bits.
 * Choix de la résolution : la plus petite image (vue d'ensemble d'un COG) d'au moins `minWidth` pixels de large.
 */
export interface GeoRaster {
  width: number;
  height: number;
  data: Float32Array;
  /** Coin haut-gauche (coordonnées projetées, m) et taille d'un pixel (m). */
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  noData: number | null;
  /** Clés GeoTIFF (projection) : numéro de clé → valeur (nombre ou texte). */
  geoKeys: Record<number, number | string>;
}
 
interface Ifd { tags: Map<number, number[] | string> }
 
const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 16: 8 };
 
export function readGeoTiff(buf: Buffer, { minWidth = 0 }: { minWidth?: number } = {}): GeoRaster {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const order = buf.toString('ascii', 0, 2);
  if (order !== 'II' && order !== 'MM') throw new Error('Pas un fichier TIFF');
  const le = order === 'II';
  const magic = dv.getUint16(2, le);
  if (magic === 43) throw new Error('BigTIFF non pris en charge');
  if (magic !== 42) throw new Error('En-tête TIFF invalide');
 
  const readValues = (type: number, count: number, at: number): number[] | string => {
    if (type === 2) return buf.toString('latin1', at, at + count).replace(/\0+$/, '');
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      const o = at + i * TYPE_SIZE[type];
      switch (type) {
        case 1: case 7: out.push(dv.getUint8(o)); break;
        case 6: out.push(dv.getInt8(o)); break;
        case 3: out.push(dv.getUint16(o, le)); break;
        case 8: out.push(dv.getInt16(o, le)); break;
        case 4: out.push(dv.getUint32(o, le)); break;
        case 9: out.push(dv.getInt32(o, le)); break;
        case 5: out.push(dv.getUint32(o, le) / dv.getUint32(o + 4, le)); break;
        case 10: out.push(dv.getInt32(o, le) / dv.getInt32(o + 4, le)); break;
        case 11: out.push(dv.getFloat32(o, le)); break;
        case 12: out.push(dv.getFloat64(o, le)); break;
        default: throw new Error(`Type TIFF ${type} non pris en charge`);
      }
    }
    return out;
  };
 
  const ifds: Ifd[] = [];
  for (let off = dv.getUint32(4, le); off && ifds.length < 64; ) {
    const n = dv.getUint16(off, le);
    const tags = new Map<number, number[] | string>();
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      const tag = dv.getUint16(e, le), type = dv.getUint16(e + 2, le), count = dv.getUint32(e + 4, le);
      const size = (TYPE_SIZE[type] ?? 1) * count;
      tags.set(tag, readValues(type, count, size <= 4 ? e + 8 : dv.getUint32(e + 8, le)));
    }
    ifds.push({ tags });
    off = dv.getUint32(off + 2 + n * 12, le);
  }
  const num = (ifd: Ifd, tag: number, def?: number): number => {
    const v = ifd.tags.get(tag);
    if (Array.isArray(v) && v.length) return v[0];
    if (def === undefined) throw new Error(`Étiquette TIFF ${tag} absente`);
    return def;
  };
  const arr = (ifd: Ifd, tag: number) => (ifd.tags.get(tag) as number[] | undefined) ?? [];
 
  // Images pleines (pas les masques) : la pleine résolution et les vues d'ensemble d'un COG.
  const images = ifds.filter((i) => (num(i, 254, 0) & 4) === 0);
  const full = images[0];
  if (!full) throw new Error('Aucune image dans le TIFF');
  const candidates = images.filter((i) => num(i, 256) >= minWidth).sort((a, b) => num(a, 256) - num(b, 256));
  const ifd = candidates[0] ?? full;
 
  const width = num(ifd, 256), height = num(ifd, 257);
  const bits = num(ifd, 258, 1), spp = num(ifd, 277, 1), fmt = num(ifd, 339, 1);
  const compression = num(ifd, 259, 1), predictor = num(ifd, 317, 1);
  if (spp !== 1 && num(ifd, 284, 1) !== 2) throw new Error('Une seule bande attendue');
  const bpp = bits / 8;
  const tiled = ifd.tags.has(322);
  const bw = tiled ? num(ifd, 322) : width;
  const bh = tiled ? num(ifd, 323) : num(ifd, 278, height);
  const offsets = arr(ifd, tiled ? 324 : 273), counts = arr(ifd, tiled ? 325 : 279);
  const across = Math.ceil(width / bw);
 
  const sample = (b: DataView, i: number): number => {
    const o = i * bpp;
    if (fmt === 3) return bits === 64 ? b.getFloat64(o, le) : b.getFloat32(o, le);
    if (fmt === 2) return bits === 8 ? b.getInt8(o) : bits === 16 ? b.getInt16(o, le) : b.getInt32(o, le);
    return bits === 8 ? b.getUint8(o) : bits === 16 ? b.getUint16(o, le) : b.getUint32(o, le);
  };
 
  const data = new Float32Array(width * height);
  for (let k = 0; k < offsets.length; k++) {
    const raw = buf.subarray(offsets[k], offsets[k] + counts[k]);
    let block: Buffer;
    if (compression === 1) block = Buffer.from(raw);
    else if (compression === 8 || compression === 32946) block = inflateSync(raw);
    else if (compression === 5) block = lzwDecode(raw);
    else throw new Error(`Compression TIFF ${compression} non prise en charge`);
    const rows = tiled ? bh : Math.min(bh, height - k * bh);
    unpredict(block, predictor, bw, rows, bpp, le);
    const bdv = new DataView(block.buffer, block.byteOffset, block.byteLength);
    const x0 = tiled ? (k % across) * bw : 0, y0 = tiled ? Math.floor(k / across) * bh : k * bh;
    for (let y = 0; y < rows && y0 + y < height; y++) {
      for (let x = 0; x < bw && x0 + x < width; x++) data[(y0 + y) * width + x0 + x] = sample(bdv, y * bw + x);
    }
  }
 
  // Géoréférencement (pris sur l'image pleine résolution, mis à l'échelle de la vue d'ensemble choisie).
  const scale = arr(full, 33550), tie = arr(full, 33922);
  const fw = num(full, 256), fh = num(full, 257);
  const resX = (scale[0] ?? 1) * (fw / width), resY = (scale[1] ?? 1) * (fh / height);
  const originX = (tie[3] ?? 0) - (tie[0] ?? 0) * (scale[0] ?? 1);
  const originY = (tie[4] ?? 0) + (tie[1] ?? 0) * (scale[1] ?? 1);
  const nd = full.tags.get(42113);
  const noData = typeof nd === 'string' && nd.trim() !== '' && Number.isFinite(Number(nd)) ? Number(nd) : null;
  // Clés GeoTIFF : répertoire (34735), paramètres doubles (34736) et textes (34737).
  const geoKeys: Record<number, number | string> = {};
  const dir = arr(full, 34735), dbl = arr(full, 34736), asc = full.tags.get(34737);
  for (let i = 4; i + 3 < dir.length; i += 4) {
    const [key, loc, count, off] = [dir[i], dir[i + 1], dir[i + 2], dir[i + 3]];
    if (loc === 0) geoKeys[key] = off;
    else if (loc === 34736) geoKeys[key] = dbl[off];
    else if (loc === 34737 && typeof asc === 'string') geoKeys[key] = asc.slice(off, off + count).replace(/\|$/, '');
  }
  return { width, height, data, originX, originY, resX, resY, noData, geoKeys };
}
 
/** Annule le prédicteur TIFF (2 : différences horizontales ; 3 : flottants, octets regroupés par plan). */
function unpredict(b: Buffer, predictor: number, w: number, rows: number, bpp: number, le: boolean) {
  if (predictor === 2) {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    for (let y = 0; y < rows; y++) {
      for (let x = 1; x < w; x++) {
        const o = (y * w + x) * bpp, p = o - bpp;
        if (bpp === 1) b[o] = (b[o] + b[p]) & 0xff;
        else if (bpp === 2) dv.setUint16(o, (dv.getUint16(o, le) + dv.getUint16(p, le)) & 0xffff, le);
        else dv.setUint32(o, (dv.getUint32(o, le) + dv.getUint32(p, le)) >>> 0, le);
      }
    }
  } else if (predictor === 3) {
    const rowBytes = w * bpp;
    const tmp = Buffer.alloc(rowBytes);
    for (let y = 0; y < rows; y++) {
      const row = b.subarray(y * rowBytes, (y + 1) * rowBytes);
      for (let i = 1; i < rowBytes; i++) row[i] = (row[i] + row[i - 1]) & 0xff;
      // Plans d'octets (poids fort d'abord) → valeurs dans l'ordre du fichier.
      for (let x = 0; x < w; x++) {
        for (let k = 0; k < bpp; k++) tmp[x * bpp + (le ? bpp - 1 - k : k)] = row[k * w + x];
      }
      tmp.copy(row);
    }
  }
}
 
/** Décompression LZW des TIFF (codes de 9 à 12 bits, poids fort d'abord, changement de largeur anticipé). */
export function lzwDecode(input: Buffer): Buffer {
  const out: number[] = [];
  let dict: number[][] = [];
  const reset = () => { dict = []; for (let i = 0; i < 256; i++) dict.push([i]); dict.push([], []); };
  reset();
  let width = 9, bitPos = 0, prev: number[] | null = null;
  const totalBits = input.length * 8;
  while (bitPos + width <= totalBits) {
    let code = 0;
    for (let i = 0; i < width; i++) {
      const bit = (input[(bitPos + i) >> 3] >> (7 - ((bitPos + i) & 7))) & 1;
      code = (code << 1) | bit;
    }
    bitPos += width;
    if (code === 257) break;
    if (code === 256) { reset(); width = 9; prev = null; continue; }
    let entry: number[];
    if (code < dict.length && dict[code].length) entry = dict[code];
    else if (prev) entry = [...prev, prev[0]];
    else throw new Error('Flux LZW invalide');
    for (const v of entry) out.push(v);
    if (prev) dict.push([...prev, entry[0]]);
    prev = entry;
    if (dict.length + 1 >= 1 << width && width < 12) width++;
  }
  return Buffer.from(out);
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Étirement radiométrique
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
/**
 * Radiance 32 bits → gris 8 bits + alpha. Les pixels au maximum (zones en plein Soleil, saturées pour ShadowCam, qui
 * est réglée pour l'ombre) deviennent transparents : l'imagerie habituelle les montre. Le reste est étiré entre les
 * percentiles 0,5 et 99,5, gamma 0,7 pour déboucher les ombres.
 */
export function stretchShadowCam(data: Float32Array, noData: number | null) {
  const n = data.length;
  const valid = (v: number) => Number.isFinite(v) && v > -1e30 && (noData === null || v !== noData);
  let max = -Infinity;
  for (let i = 0; i < n; i++) if (valid(data[i]) && data[i] > max) max = data[i];
  const satLevel = max - Math.abs(max) * 0.002;
  let sat = 0, count = 0;
  for (let i = 0; i < n; i++) if (valid(data[i])) { count++; if (data[i] >= satLevel) sat++; }
  const masking = count > 0 && sat / count > 0.005; // assez de pixels au plafond : c'est de la saturation
  const step = Math.max(1, Math.floor(n / 200_000));
  const sample: number[] = [];
  for (let i = 0; i < n; i += step) {
    const v = data[i];
    if (valid(v) && !(masking && v >= satLevel)) sample.push(v);
  }
  sample.sort((a, b) => a - b);
  const q = (f: number) => (sample.length ? sample[Math.min(sample.length - 1, Math.floor(f * sample.length))] : 0);
  const lo = q(0.005), hi = Math.max(q(0.995), lo + 1e-12);
  const ga = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const v = data[i];
    if (!valid(v) || (masking && v >= satLevel)) continue; // alpha 0
    const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    ga[i * 2] = Math.round(255 * Math.pow(t, 0.7));
    ga[i * 2 + 1] = 255;
  }
  return { ga, stretch: { lo, hi, sunlitFraction: count ? (masking ? sat / count : 0) : 0 } };
}
 
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Catalogue et service
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
 
const TIMEOUT_MS = 180_000;
const CATALOG_TTL_MS = 24 * 3_600_000;
export const SHADOWCAM_RESOLUTIONS = [20, 5] as const; // m/pixel (la version 2 m pèse jusqu'à 400 Mo : non relayée)
 
export interface ShadowCamMosaic {
  id: string;
  site: string;
  name: string;
  pole: 'north' | 'south';
  lat: number;
  lon: number;
  season: string;
  localTime: string;
  dir: string;
}
 
export interface ShadowCamImageMeta extends PolarParams {
  id: string;
  res: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  resX: number;
  resY: number;
  stretch: { lo: number; hi: number; sunlitFraction: number };
}
 
// Noms de cratères satellites (lettre accolée dans les noms de fichiers PDS).
const SITE_NAMES: Record<string, string> = {
  hermitea: 'Hermite A', idelsonl: 'Idel’son L', lovelacee: 'Lovelace E', sylvestern: 'Sylvester N', wiechertj: 'Wiechert J',
  cabeusb: 'Cabeus B', shoemaker: 'Shoemaker', faustini: 'Faustini', shackleton: 'Shackleton', amundsen: 'Amundsen',
  hinshelwood: 'Hinshelwood', kocher: 'Kocher', kuhn: 'Kuhn', 'unnamed-psr-in-rozhdestvenskiy': 'Zone d’ombre de Rozhdestvenskiy',
};
 
const SEASON_FR: Record<string, string> = { spring: 'printemps', summer: 'été', fall: 'automne', autumn: 'automne', winter: 'hiver' };
 
/**
 * Nom PDS → description. Ex. shadowcam_cmosaic_shackleton01_p896s1350_summer_11am :
 * site « shackleton01 », centre 89,6° S 135,0° E, saison et heure locale de l'éclairage indirect.
 */
export function parseMosaicId(id: string): ShadowCamMosaic | null {
  const m = /^shadowcam_cmosaic_(.+?)_p(\d{3})([ns])(\d{4})_([a-z]+)_(\d{1,2}(?:am|pm))$/.exec(id);
  if (!m) return null;
  const [, site, lat10, ns, lon10, season, localTime] = m;
  const pole = ns === 'n' ? 'north' : 'south';
  const lonE = Number(lon10) / 10;
  const base = site.replace(/\d+$/, '');
  const num = site.slice(base.length);
  const pretty = SITE_NAMES[base] ?? base.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return {
    id, site, dir: site, pole,
    name: `${pretty}${num && num !== '01' ? ` (${Number(num)})` : ''}`,
    lat: (pole === 'south' ? -1 : 1) * Number(lat10) / 10,
    lon: lonE > 180 ? lonE - 360 : lonE,
    season: SEASON_FR[season] ?? season,
    localTime,
  };
}
 
/**
 * Mosaïques contrôlées de ShadowCam, la caméra de la NASA à bord de Danuri (KPLO, KARI) : elle photographie le fond
 * des cratères en ombre permanente des deux pôles, éclairé seulement par la lumière renvoyée par les reliefs voisins.
 * Source : archive PDS de l'équipe ShadowCam (https://pds.shadowcam.im-ldi.com/derived/cmosaic/), GeoTIFF
 * stéréographique polaire 32 bits. Le serveur les télécharge une fois, les étire en 8 bits (zones éclairées, saturées
 * dans ShadowCam, rendues transparentes) et les sert en PNG avec leur géoréférencement.
 */
@Injectable()
export class ShadowCamService {
  private readonly log = new Logger('ShadowCam');
  private catalog: { at: number; data: Promise<ShadowCamMosaic[]> } | null = null;
  private readonly inflight = new Map<string, Promise<{ meta: ShadowCamImageMeta; png: Buffer }>>();
 
  constructor(
    private readonly config: AppConfig,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}
 
  private get base() { return this.config.danuri.shadowcamPdsUrl; }
  private get dir() { return path.resolve(path.dirname(path.resolve(this.config.tiles.moonCache.dir)), 'shadowcam'); }
 
  list(): Promise<ShadowCamMosaic[]> {
    const now = Date.now();
    if (this.catalog && now - this.catalog.at < CATALOG_TTL_MS) return this.catalog.data;
    const data = this.loadCatalog().catch((e) => { if (this.catalog?.data === data) this.catalog = null; throw e; });
    this.catalog = { at: now, data };
    return data;
  }
 
  private async loadCatalog(): Promise<ShadowCamMosaic[]> {
    const url = `${this.base}/derived/collection_kplo-shadowcam_derived-cmosaic.csv`;
    const text = await this.fetchText(url);
    const ids = new Set<string>();
    for (const line of text.split(/\r?\n/)) {
      const m = /derived-cmosaic:([a-z0-9_-]+)::/.exec(line);
      if (m) ids.add(m[1].replace(/_(\d+)m$/, ''));
    }
    const out = [...ids].map(parseMosaicId).filter((x): x is ShadowCamMosaic => Boolean(x));
    if (!out.length) throw new BadGatewayException('Catalogue ShadowCam vide ou illisible');
    return out.sort((a, b) => a.pole.localeCompare(b.pole) || a.name.localeCompare(b.name));
  }
 
  async meta(id: string, res: number): Promise<ShadowCamImageMeta> { return (await this.image(id, res)).meta; }
  async png(id: string, res: number): Promise<Buffer> { return (await this.image(id, res)).png; }
 
  private async image(id: string, res: number) {
    if (!SHADOWCAM_RESOLUTIONS.includes(res as 20 | 5)) throw new NotFoundException('Résolutions proposées : 20 ou 5 m/pixel.');
    const mosaic = (await this.list()).find((m) => m.id === id);
    if (!mosaic) throw new NotFoundException(`Mosaïque ShadowCam inconnue : ${id}`);
    const key = `${id}_${res}m`;
    let p = this.inflight.get(key);
    if (!p) {
      p = this.build(mosaic, res).finally(() => this.inflight.delete(key));
      this.inflight.set(key, p);
    }
    return p;
  }
 
  private async build(m: ShadowCamMosaic, res: number) {
    const stem = path.join(this.dir, `${m.id}_${res}m`);
    try {
      const [metaText, png] = await Promise.all([fs.readFile(`${stem}.json`, 'utf8'), fs.readFile(`${stem}.png`)]);
      return { meta: JSON.parse(metaText) as ShadowCamImageMeta, png };
    } catch { /* pas encore préparée */ }
 
    const url = `${this.base}/derived/cmosaic/${m.dir}/${m.id}_${res}m_cog.tif`;
    this.log.log(`Téléchargement ${url}`);
    const tif = await this.fetchBuffer(url);
    const r = readGeoTiff(tif);
    const { ga, stretch } = stretchShadowCam(r.data, r.noData);
    const params = polarParamsFromKeys(r.geoKeys, m.pole);
    const meta: ShadowCamImageMeta = {
      id: m.id, res, width: r.width, height: r.height, originX: r.originX, originY: r.originY, resX: r.resX, resY: r.resY,
      ...params, stretch,
    };
    const png = encodeGrayAlphaPng(r.width, r.height, ga);
    try {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(`${stem}.png`, png);
      await fs.writeFile(`${stem}.json`, JSON.stringify(meta));
    } catch (e) {
      this.log.warn(`Cache ShadowCam impossible : ${(e as Error).message}`);
    }
    return { meta, png };
  }
 
  private async fetchText(url: string) { return (await this.fetchBuffer(url)).toString('utf8'); }
 
  private async fetchBuffer(url: string): Promise<Buffer> {
    let res: Response;
    try {
      res = await this.fetchFn(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      throw new BadGatewayException(`Archive ShadowCam injoignable (${url}) : ${(e as Error).message}`);
    }
    if (res.status === 404) throw new NotFoundException(`Fichier absent de l’archive ShadowCam : ${url}`);
    if (!res.ok) throw new BadGatewayException(`Archive ShadowCam : HTTP ${res.status} (${url})`);
    return Buffer.from(await res.arrayBuffer());
  }
}
 