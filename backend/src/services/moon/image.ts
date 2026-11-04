import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import type { ImageInfo } from './moon.types';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const SOF_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function etagFromSha(sha256: string): string {
  return `"sha256-${sha256}"`;
}

export function inspectImage(buffer: Buffer): ImageInfo | null {
  const png = readPng(buffer);
  if (png) {
    return {
      format: 'png',
      width: png.width,
      height: png.height,
      bytes: buffer.length,
      sha256: sha256Hex(buffer),
    };
  }

  const jpeg = readJpeg(buffer);
  if (jpeg) {
    return {
      format: 'jpeg',
      width: jpeg.width,
      height: jpeg.height,
      bytes: buffer.length,
      sha256: sha256Hex(buffer),
    };
  }

  return null;
}

function readPng(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function readJpeg(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (
      marker === 0xd8 ||
      marker === 0x01 ||
      (marker >= 0xd0 && marker <= 0xd7)
    ) {
      offset += 2;
      continue;
    }

    if (marker === 0xd9 || marker === 0xda) {
      return null;
    }

    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      return null;
    }

    if (SOF_MARKERS.has(marker)) {
      if (offset + 9 > buffer.length) {
        return null;
      }
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}
