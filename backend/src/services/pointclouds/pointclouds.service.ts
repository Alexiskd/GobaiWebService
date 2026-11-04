import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Stats } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { APP_CONFIG } from '../../modules/config.module';
import type { AppConfig } from '../../common/configuration';

/** Fichier de nuage de points servi tel quel au navigateur (Potree ou un loader COPC lisent l'en-tête eux-mêmes). */
export interface PointCloudFile {
  name: string;
  sizeBytes: number;
  modifiedAt: Date;
  path: string;
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

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.dir = resolve(config.pointclouds.dir);
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

    const files = await Promise.all(names.map((name) => this.get(name).catch(() => null)));
    return files
      .filter((file): file is PointCloudFile => file !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Décrit un fichier précis ; refuse tout nom qui sortirait du répertoire configuré. */
  async get(name: string): Promise<PointCloudFile> {
    const path = this.resolveFile(name);
    let info: Stats;
    try {
      info = await lstat(path);
    } catch (error) {
      if (isMissing(error)) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
      throw error;
    }
    if (!info.isFile()) throw new NotFoundException(`Nuage de points introuvable : ${name}.`);
    return { name, sizeBytes: info.size, modifiedAt: info.mtime, path };
  }

  private resolveFile(name: string): string {
    if (name !== basename(name) || !POINT_CLOUD_NAME.test(name) || !POINT_CLOUD_EXTENSION.test(name)) {
      throw new BadRequestException('Nom de nuage de points invalide (lettres, chiffres, « . », « _ », « - » ; extension .las ou .laz).');
    }
    return join(this.dir, name);
  }
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
