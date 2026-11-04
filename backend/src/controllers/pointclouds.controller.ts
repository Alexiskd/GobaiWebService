import { BadRequestException, Controller, Get, Param, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { ApiErrorDto } from '../dto/api-error.dto';
import { PointCloudDto, PointCloudListDto } from '../dto/pointclouds.dto';
import { PointCloudFile, PointCloudsService, parseRange } from '../services/pointclouds/pointclouds.service';

/**
 * Nuages de points LiDAR : le serveur ne fait que lister et servir les fichiers COPC/LAS.
 * Le rendu (Potree, Deck.gl, Cesium) et la lecture de l'octree se font dans le navigateur.
 */
@ApiTags('Nuages de points')
@Controller('pointclouds')
export class PointCloudsController {
  constructor(private readonly pointClouds: PointCloudsService) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les nuages de points disponibles',
    description: 'Fichiers LAS/LAZ présents dans le répertoire configuré par `POINTCLOUD_DIR`.',
  })
  @ApiOkResponse({ type: PointCloudListDto })
  async list(): Promise<PointCloudListDto> {
    const files = await this.pointClouds.list();
    return { items: files.map(toDto) };
  }

  @Get(':name')
  @ApiOperation({
    summary: 'Décrire un nuage de points',
    description: 'Taille, date de modification et URL du flux binaire.',
  })
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  @ApiOkResponse({ type: PointCloudDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Nom de fichier refusé.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async metadata(@Param('name') name: string): Promise<PointCloudDto> {
    return toDto(await this.pointClouds.get(name));
  }

  @Get(':name/file')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Télécharger le fichier (requêtes Range)',
    description:
      'Sert le fichier tel quel, avec support de `Range: bytes=…` et réponses 206. Indispensable au streaming COPC : le lecteur demande la hiérarchie puis chaque nœud.',
  })
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  @ApiOkResponse({ description: 'Flux binaire complet.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'En-tête `Range` invalide.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async file(@Param('name') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const file = await this.pointClouds.get(name);
    const range = parseRange(req.headers.range, file.sizeBytes);

    if (range.kind === 'invalid') {
      throw new BadRequestException('En-tête Range invalide : une seule plage « bytes=début-fin » est acceptée.');
    }
    if (range.kind === 'unsatisfiable') {
      res.status(416);
      res.setHeader('Content-Range', `bytes */${file.sizeBytes}`);
      res.end();
      return;
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Last-Modified', file.modifiedAt.toUTCString());
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (file.sizeBytes === 0) {
      res.end();
      return;
    }

    const start = range.kind === 'partial' ? range.start : 0;
    const end = range.kind === 'partial' ? range.end : file.sizeBytes - 1;
    if (range.kind === 'partial') {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${file.sizeBytes}`);
    }
    res.setHeader('Content-Length', String(end - start + 1));

    const stream = createReadStream(file.path, { start, end });
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  }
}

function toDto(file: PointCloudFile): PointCloudDto {
  return {
    name: file.name,
    sizeBytes: file.sizeBytes,
    modifiedAt: file.modifiedAt.toISOString(),
    fileUrl: `/api/v1/pointclouds/${encodeURIComponent(file.name)}/file`,
  };
}
