import { inflateSync } from 'node:zlib';

/** Image décodée ramenée à une bande de gris (luminance) + transparence. */
export interface GrayImage { width: number; height: number; gray: Uint8Array; alpha: Uint8Array | null }

/**
 * Décodeur PNG minimal (sans dépendance) pour les tuiles NASA Moon Trek : 8 ou 16 bits, gris, gris + alpha, RVB,
 * RVBA ou palette, non entrelacé. Le résultat est ramené en luminance (les mosaïques lunaires sont en gris).
 */
export function decodePng(buf: Buffer): GrayImage {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Pas un PNG');
  let pos = 8, width = 0, height = 0, depth = 8, type = 0, interlace = 0;
  let palette: Buffer | null = null, trns: Buffer | null = null;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (kind === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); depth = data[8]; type = data[9]; interlace = data[12]; }
    else if (kind === 'PLTE') palette = data;
    else if (kind === 'tRNS') trns = data;
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    pos += 12 + len;
  }
  if (interlace) throw new Error('PNG entrelacé non pris en charge');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type as 0 | 2 | 3 | 4 | 6];
  if (!channels) throw new Error(`PNG de type ${type} non pris en charge`);
  const bitsPerPixel = channels * depth;
  const bpp = Math.max(1, bitsPerPixel >> 3);
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const raw = inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev ? prev[i] : 0, c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = src[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 0xff;
    }
  }
  const n = width * height;
  const gray = new Uint8Array(n);
  const hasAlpha = type === 4 || type === 6 || Boolean(trns);
  const alpha = hasAlpha ? new Uint8Array(n).fill(255) : null;
  const sample = (row: number, idx: number): number => { // valeur 8 bits du canal n° idx (sous-octets : gris/palette)
    if (depth === 16) return out[row * stride + idx * 2];
    if (depth === 8) return out[row * stride + idx];
    const per = 8 / depth, byte = out[row * stride + Math.floor(idx / per)];
    const v = (byte >> (8 - depth * ((idx % per) + 1))) & ((1 << depth) - 1);
    return type === 3 ? v : Math.round((v * 255) / ((1 << depth) - 1));
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = y * width + x, base = x * channels;
      if (type === 0) { gray[k] = sample(y, base); if (trns && alpha && gray[k] === (depth === 16 ? trns[0] : trns[1])) alpha[k] = 0; }
      else if (type === 4) { gray[k] = sample(y, base); alpha![k] = sample(y, base + 1); }
      else if (type === 3) {
        const i = sample(y, base), r = palette![i * 3], g = palette![i * 3 + 1], b = palette![i * 3 + 2];
        gray[k] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        if (alpha && trns && i < trns.length) alpha[k] = trns[i];
      } else {
        const r = sample(y, base), g = sample(y, base + 1), b = sample(y, base + 2);
        gray[k] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        if (type === 6) alpha![k] = sample(y, base + 3);
      }
    }
  }
  return { width, height, gray, alpha };
}
