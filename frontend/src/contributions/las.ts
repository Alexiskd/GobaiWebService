import type { Bounds3D, LasMetadata } from './types';

export const MAX_UPLOAD_BYTES = 256 * 1024 * 1024;
export const MAX_POINT_COUNT = 10_000_000;
const MAX_WKT_BYTES = 1_000_000;
const MAX_VLR_COUNT = 4096;

export async function inspectLasFile(file: File): Promise<LasMetadata> {
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'las' && extension !== 'laz') {
    throw new TypeError('Seuls les fichiers .las et .laz sont acceptés.');
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    throw new RangeError(`La taille du fichier doit être comprise entre 1 octet et ${MAX_UPLOAD_BYTES} octets.`);
  }
  const first = await file.slice(0, 375).arrayBuffer();
  const header = parseLasHeader(first);
  validateLasMetadata(header, file.size);
  return { ...header, crsWkt: await readCrsWkt(file, header) };
}

export function parseLasHeader(data: ArrayBuffer): Omit<LasMetadata, 'crsWkt'> {
  const bytes = new DataView(data);
  if (data.byteLength < 227 || new TextDecoder().decode(new Uint8Array(data, 0, 4)) !== 'LASF') {
    throw new TypeError('En-tête LAS invalide : signature LASF absente.');
  }
  const major = bytes.getUint8(24);
  const minor = bytes.getUint8(25);
  if (major !== 1 || minor > 4) throw new TypeError(`Version LAS non prise en charge : ${major}.${minor}.`);

  const headerSize = bytes.getUint16(94, true);
  if (headerSize < 227 || data.byteLength < Math.min(headerSize, 375)) {
    throw new TypeError('En-tête LAS tronqué ou de taille incohérente.');
  }
  const pointDataOffset = bytes.getUint32(96, true);
  const pointFormatFlags = bytes.getUint8(104);
  const pointFormat = pointFormatFlags & 0x3f;
  if (pointFormat > 10) throw new TypeError(`Format de point LAS non pris en charge : ${pointFormat}.`);
  const legacyCount = bytes.getUint32(107, true);
  const extendedCount = major === 1 && minor === 4 && headerSize >= 375 && data.byteLength >= 375
    ? Number(bytes.getBigUint64(247, true))
    : 0;
  const pointCount = extendedCount || legacyCount;
  const pointRecordLength = bytes.getUint16(105, true);
  const bounds: Bounds3D = {
    maxX: bytes.getFloat64(179, true),
    minX: bytes.getFloat64(187, true),
    maxY: bytes.getFloat64(195, true),
    minY: bytes.getFloat64(203, true),
    maxZ: bytes.getFloat64(211, true),
    minZ: bytes.getFloat64(219, true),
  };
  const scale: [number, number, number] = [
    bytes.getFloat64(131, true),
    bytes.getFloat64(139, true),
    bytes.getFloat64(147, true),
  ];
  const offset: [number, number, number] = [
    bytes.getFloat64(155, true),
    bytes.getFloat64(163, true),
    bytes.getFloat64(171, true),
  ];

  return {
    version: `${major}.${minor}`,
    pointFormat,
    pointCount,
    pointDataOffset,
    pointRecordLength,
    compressed: (pointFormatFlags & 0x80) !== 0,
    scale,
    offset,
    bounds,
  };
}

export function validateLasMetadata(metadata: Omit<LasMetadata, 'crsWkt'>, fileSize: number): void {
  if (metadata.pointCount < 1 || metadata.pointCount > MAX_POINT_COUNT) {
    throw new RangeError(`Le nuage doit contenir entre 1 et ${MAX_POINT_COUNT.toLocaleString('fr-FR')} points.`);
  }
  if (!Number.isSafeInteger(metadata.pointCount) || metadata.pointDataOffset >= fileSize || metadata.pointRecordLength < 1) {
    throw new TypeError('Métadonnées LAS incohérentes avec la taille du fichier.');
  }
  if (
    metadata.scale.some((value) => !Number.isFinite(value) || value <= 0)
    || metadata.offset.some((value) => !Number.isFinite(value))
    || Object.values(metadata.bounds).some((value) => !Number.isFinite(value))
    || metadata.bounds.minX > metadata.bounds.maxX
    || metadata.bounds.minY > metadata.bounds.maxY
    || metadata.bounds.minZ > metadata.bounds.maxZ
  ) {
    throw new TypeError('Échelle, décalage ou emprise LAS invalide.');
  }
}

async function readCrsWkt(file: File, header: Omit<LasMetadata, 'crsWkt'>): Promise<string | null> {
  const fixedHeader = new DataView(await file.slice(0, 375).arrayBuffer());
  const headerSize = fixedHeader.getUint16(94, true);
  const pointDataOffset = fixedHeader.getUint32(96, true);
  const vlrCount = fixedHeader.getUint32(100, true);
  if (vlrCount > MAX_VLR_COUNT) return null;

  let offset = headerSize;
  for (let index = 0; index < vlrCount; index++) {
    if (offset + 54 > pointDataOffset) return null;
    const record = new DataView(await file.slice(offset, offset + 54).arrayBuffer());
    const userId = new TextDecoder().decode(new Uint8Array(await file.slice(offset + 2, offset + 18).arrayBuffer()))
      .replace(/\0+$/, '').trim();
    const recordId = record.getUint16(18, true);
    const length = record.getUint16(20, true);
    const dataOffset = offset + 54;
    if (dataOffset + length > pointDataOffset) return null;
    if (userId === 'LASF_Projection' && recordId === 2112 && length <= MAX_WKT_BYTES) {
      return decodeText(await file.slice(dataOffset, dataOffset + length).arrayBuffer());
    }
    offset = dataOffset + length;
  }

  if (header.version !== '1.4' || fixedHeader.byteLength < 375) return null;
  const evlrOffset = Number(fixedHeader.getBigUint64(235, true));
  const evlrCount = fixedHeader.getUint32(243, true);
  if (!Number.isSafeInteger(evlrOffset) || evlrOffset <= 0 || evlrCount === 0 || evlrCount > MAX_VLR_COUNT) return null;

  offset = evlrOffset;
  for (let index = 0; index < evlrCount; index++) {
    const recordBytes = await file.slice(offset, offset + 60).arrayBuffer();
    if (recordBytes.byteLength < 60) return null;
    const record = new DataView(recordBytes);
    const userBytes = await file.slice(offset + 2, offset + 18).arrayBuffer();
    const userId = new TextDecoder().decode(userBytes).replace(/\0+$/, '').trim();
    const recordId = record.getUint16(18, true);
    const length = Number(record.getBigUint64(20, true));
    const dataOffset = offset + 60;
    if (!Number.isSafeInteger(length) || length < 0 || dataOffset + length > file.size) return null;
    if (userId === 'LASF_Projection' && recordId === 2112 && length <= MAX_WKT_BYTES) {
      return decodeText(await file.slice(dataOffset, dataOffset + length).arrayBuffer());
    }
    offset = dataOffset + length;
  }
  return null;
}

function decodeText(data: ArrayBuffer): string | null {
  return new TextDecoder('utf-8', { fatal: false }).decode(data).replace(/\0+$/, '').trim() || null;
}
