import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

const LYON_EPT_ORIGIN = 'https://download.data.grandlyon.com/files/grandlyon/imagerie/mnt2018/lidar/ept';
const LYON_SOURCE_URL = 'https://www.data.gouv.fr/datasets/nuage-de-points-lidar-2018-de-la-metropole-de-lyon-format-laz';

export interface LyonPointCloudMetadata {
  title: string;
  sourceUrl: string;
  eptUrl: string;
  license: string;
  pointCount: string;
  coordinateSystem: string;
  bounds: { minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
  note: string;
}

@Injectable()
export class LyonLidarService {
  getMetadata(): LyonPointCloudMetadata {
    return {
      title: 'Nuage de points LiDAR 2018 — Métropole de Lyon',
      sourceUrl: LYON_SOURCE_URL,
      eptUrl: '/api/v1/pointclouds/lyon/ept/ept.json',
      license: 'Licence Ouverte / Open Licence 2.0 (LOv2)',
      pointCount: '13791199599',
      coordinateSystem: 'EPSG:3946 — RGF93 / CC46',
      bounds: {
        minX: 1829188,
        minY: 5150048,
        minZ: -23,
        maxX: 1870353,
        maxY: 5197981,
        maxZ: 810,
      },
      note: 'Nuage colorisé à partir de l’orthophotographie 2018.',
    };
  }

  async getAsset(assetPath: string, range?: string): Promise<Response> {
    const url = resolveAssetUrl(assetPath);
    if (range && !isValidRange(range)) {
      throw new BadRequestException('En-tête Range invalide.');
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: range ? { Range: range.trim() } : undefined,
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new BadGatewayException('La source LiDAR de la Métropole de Lyon est indisponible.');
    }

    if (response.status === 404) throw new NotFoundException('Ressource EPT introuvable.');
    if (!response.ok) {
      throw new BadGatewayException(`La source LiDAR a répondu avec le statut HTTP ${response.status}.`);
    }
    return response;
  }
}

function resolveAssetUrl(assetPath: string): string {
  const segments = assetPath.split('/');
  if (
    !assetPath
    || segments.some((segment) => !/^[A-Za-z0-9._-]{1,120}$/.test(segment) || segment === '.' || segment === '..')
    || !(
      assetPath === 'ept.json'
      || (segments[0] === 'ept-data' && segments.length > 1 && /\.laz$/i.test(segments[segments.length - 1]))
      || (segments[0] === 'ept-hierarchy' && segments.length > 1 && /\.json$/i.test(segments[segments.length - 1]))
    )
  ) {
    throw new BadRequestException('Chemin de ressource EPT invalide.');
  }

  return `${LYON_EPT_ORIGIN}/${segments.map(encodeURIComponent).join('/')}`;
}

function isValidRange(header: string): boolean {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1] ? Number(match[1]) : null;
  const end = match[2] ? Number(match[2]) : null;
  if (
    (start !== null && !Number.isSafeInteger(start))
    || (end !== null && !Number.isSafeInteger(end))
    || (start !== null && end !== null && start > end)
    || (start === null && end === 0)
  ) {
    return false;
  }
  return true;
}
