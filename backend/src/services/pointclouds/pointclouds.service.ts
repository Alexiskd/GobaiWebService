import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Stats } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';

export interface PointCloudHeader {
  version: string;
  pointFormat: number;
  pointCount: string;
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  coordinateSystemWkt: string | null;
}

/** Fichier de nuage de points servi tel quel au navigateur (Potree ou un loader COPC lisent l'en-tête eux-mêmes). */
export interface PointCloudFile {
  name: string;
  sizeBytes: number;
  modifiedAt: Date;
  path: string;
  header: PointCloudHeader | null;
  potreeAvailable: boolean;
}

/** Résultat de l'analyse d'un en-tête `Range` (RFC 9110, une seule plage). */
export type ByteRange =
  | { kind: 'full' }
  | { kind: 'partial'; start: number; end: number }
  | { kind: 'invalid' }
  | { kind: 'unsatisfiable' };

const POINT_CLOUD_NAME = /^[A-Za-z0-9._-]{1,200}$/;
const POINT_CLOUD_EXTENSION = /\.(las|laz)$/i;

@Injectable()
export class PointCloudsService {
  private readonly dir: string;
  private readonly potreeDir: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.dir = resolve(config.pointclouds.dir);
    this.potreeDir = join(this.dir, 'potree');
  }

  /** Fichiers LAS/LAZ du répertoire configuré, triés par nom. Répertoire absent = liste vide. */
  async list(): Promise<PointCloudFile[]> {
    let names: string[];
    try {
      const entries = await readdir(this.dir, { withFileTypes: true });
      names = entries.filter((e) => e.isFile() && POINT_CLOUD_EXTENSION.test(e.name)).map((e) => e.name);
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }

    const files = await Promise.all(names.map(async (name) => {
      try {
        return await this.get(name);
      } catch (error) {
        if (error instanceof NotFoundException) return null;
        throw error;
      }
    }));
    return files
      .filter((file): file is PointCloudFile => file !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Décrit un fichier précis ; refuse tout nom qui sortirait du répertoire configuré. */
  async get(name: string): Promise<PointCloudFile> {
    const file = await this.getFile(name);
    const [header, potreeAvailable] = await Promise.all([
      readPointCloudHeader(file.path),
      this.hasPotreeDataset(name),
    ]);
    return { ...file, header, potreeAvailable };
  }

  /** Résout uniquement les informations système nécessaires à un flux binaire Range. */
  async getFile(name: string): Promise<PointCloudFile> {
    const path = this.resolveFile(name);
    let info: Stats;
    try {
      info = await lstat(path);
    } catch (error) {
      if (isMissing(error)) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
      throw error;
    }
    if (!info.isFile()) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
    return { name, sizeBytes: info.size, modifiedAt: info.mtime, path, header: null, potreeAvailable: false };
  }

  /** Résout une ressource d’un nuage Potree converti, sans autoriser de sortie du répertoire dédié. */
  async getPotreeAsset(name: string, assetPath: string): Promise<PointCloudFile> {
    this.resolveFile(name);
    const segments = assetPath.split('/');
    if (!assetPath || segments.some((segment) => !/^[A-Za-z0-9._-]{1,200}$/.test(segment) || segment === '.' || segment === '..')) {
      throw new BadRequestException('Chemin de ressource Potree invalide.');
    }

    const datasetDir = join(this.potreeDir, name);
    const path = resolve(datasetDir, ...segments);
    if (!isWithin(datasetDir, path)) throw new BadRequestException('Chemin de ressource Potree invalide.');

    let info: Stats;
    try {
      const [sourceRoot, potreeRoot, rootPath, resolvedPath] = await Promise.all([
        realpath(this.dir),
        realpath(this.potreeDir),
        realpath(datasetDir),
        realpath(path),
      ]);
      if (!isWithin(sourceRoot, potreeRoot) || !isWithin(potreeRoot, rootPath) || !isWithin(rootPath, resolvedPath)) {
        throw new BadRequestException('Ressource Potree hors du répertoire autorisé.');
      }
      info = await lstat(resolvedPath);
      if (!info.isFile()) throw new NotFoundException(`Ressource Potree introuvable : ${assetPath}.`);
      return {
        name: segments[segments.length - 1],
        sizeBytes: info.size,
        modifiedAt: info.mtime,
        path: resolvedPath,
        header: null,
        potreeAvailable: true,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      if (isMissing(error)) throw new NotFoundException(`Ressource Potree introuvable : ${assetPath}.`);
      throw error;
    }
  }

  private resolveFile(name: string): string {
    if (name !== basename(name) || !POINT_CLOUD_NAME.test(name) || !POINT_CLOUD_EXTENSION.test(name)) {
      throw new BadRequestException('Nom de nuage de points invalide (lettres, chiffres, « . », « _ », « - » ; extension .las ou .laz).');
    }
    return join(this.dir, name);
  }

  private async hasPotreeDataset(name: string): Promise<boolean> {
    const datasetDir = join(this.potreeDir, name);
    try {
      const [sourceRoot, potreeRoot, rootPath, cloudPath] = await Promise.all([
        realpath(this.dir),
        realpath(this.potreeDir),
        realpath(datasetDir),
        realpath(join(datasetDir, 'cloud.js')),
      ]);
      if (!isWithin(sourceRoot, potreeRoot) || !isWithin(potreeRoot, rootPath) || !isWithin(rootPath, cloudPath)) return false;
      return (await lstat(cloudPath)).isFile();
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
  }
}

async function readPointCloudHeader(path: string): Promise<PointCloudHeader | null> {
  const file = await open(path, 'r');
  try {
    const header = await readAt(file, 0, 375);
    if (header.length < 227 || header.toString('ascii', 0, 4) !== 'LASF') return null;

    const headerSize = header.readUInt16LE(94);
    if (headerSize < 227) return null;

    const versionMajor = header.readUInt8(24);
    const versionMinor = header.readUInt8(25);
    const pointFormat = header.readUInt8(104) & 0x3f;
    const pointCount = versionMinor >= 4 && headerSize >= 375 && header.length >= 375
      ? header.readBigUInt64LE(247).toString()
      : String(header.readUInt32LE(107));
    const bounds = {
      maxX: header.readDoubleLE(179),
      minX: header.readDoubleLE(187),
      maxY: header.readDoubleLE(195),
      minY: header.readDoubleLE(203),
      maxZ: header.readDoubleLE(211),
      minZ: header.readDoubleLE(219),
    };
    if (Object.values(bounds).some((value) => !Number.isFinite(value))) return null;

    const wkt = await readProjectionWkt(file, header, headerSize);
    return {
      version: `${versionMajor}.${versionMinor}`,
      pointFormat,
      pointCount,
      bounds,
      coordinateSystemWkt: wkt,
    };
  } finally {
    await file.close();
  }
}

async function readProjectionWkt(
  file: Awaited<ReturnType<typeof open>>,
  header: Buffer,
  headerSize: number,
): Promise<string | null> {
  const pointOffset = header.readUInt32LE(96);
  const vlrCount = header.readUInt32LE(100);
  if (vlrCount > 4096) return null;
  let offset = headerSize;
  for (let i = 0; i < vlrCount; i++) {
    const record = await readAt(file, offset, 54);
    if (record.length < 54 || offset + 54 > pointOffset) return null;
    const userId = record.toString('ascii', 2, 18).replace(/\0+$/, '').trim();
    const recordId = record.readUInt16LE(18);
    const recordLength = record.readUInt16LE(20);
    offset += 54;
    if (offset + recordLength > pointOffset) return null;
    if (userId === 'LASF_Projection' && recordId === 2112 && recordLength <= 1_000_000) {
      const value = await readAt(file, offset, recordLength);
      return value.toString('utf8').replace(/\0+$/, '').trim() || null;
    }
    offset += recordLength;
  }

  if (header.length < 375 || headerSize < 375) return null;
  const evlrOffset = Number(header.readBigUInt64LE(235));
  const evlrCount = header.readUInt32LE(243);
  if (!Number.isSafeInteger(evlrOffset) || evlrOffset <= 0 || evlrCount === 0 || evlrCount > 4096) return null;
  offset = evlrOffset;
  for (let i = 0; i < evlrCount; i++) {
    const record = await readAt(file, offset, 60);
    if (record.length < 60) return null;
    const userId = record.toString('ascii', 2, 18).replace(/\0+$/, '').trim();
    const recordId = record.readUInt16LE(18);
    const recordLength = Number(record.readBigUInt64LE(20));
    offset += 60;
    if (!Number.isSafeInteger(recordLength) || recordLength < 0 || offset + recordLength > Number.MAX_SAFE_INTEGER) return null;
    if (userId === 'LASF_Projection' && recordId === 2112 && recordLength <= 1_000_000) {
      const value = await readAt(file, offset, recordLength);
      return value.toString('utf8').replace(/\0+$/, '').trim() || null;
    }
    offset += recordLength;
  }
  return null;
}

async function readAt(file: Awaited<ReturnType<typeof open>>, position: number, length: number): Promise<Buffer> {
  const buffer = Buffer.alloc(length);
  const { bytesRead } = await file.read(buffer, 0, length, position);
  return buffer.subarray(0, bytesRead);
}

function isWithin(root: string, path: string): boolean {
  const fromRoot = relative(root, path);
  return fromRoot === '' || (!fromRoot.startsWith('..') && !isAbsolute(fromRoot));
}

/**
 * Convertit l'en-tête `Range` en plage d'octets. Seule la forme `bytes=a-b`, `bytes=a-` ou `bytes=-n` est acceptée :
 * c'est tout ce dont un lecteur COPC a besoin pour demander la hiérarchie puis des nœuds isolés.
 */
export function parseRange(header: string | undefined, sizeBytes: number): ByteRange {
  if (header === undefined || header.trim() === '') return { kind: 'full' };

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return { kind: 'invalid' };

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') return { kind: 'invalid' };
  if (sizeBytes <= 0) return { kind: 'unsatisfiable' };

  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { kind: 'invalid' };
    return { kind: 'partial', start: Math.max(0, sizeBytes - suffix), end: sizeBytes - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === '' ? sizeBytes - 1 : Number(rawEnd);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) return { kind: 'invalid' };
  if (start >= sizeBytes) return { kind: 'unsatisfiable' };
  return { kind: 'partial', start, end: Math.min(end, sizeBytes - 1) };
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}
