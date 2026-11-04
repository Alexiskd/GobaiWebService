import { BadRequestException, Controller, Get, Param, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'node:fs';
import { extname } from 'node:path';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { ApiErrorDto } from '../dto/api-error.dto';
import { LyonPointCloudDto } from '../dto/lyon-pointcloud.dto';
import { PointCloudDto, PointCloudListDto } from '../dto/pointclouds.dto';
import { LyonLidarService } from '../services/pointclouds/lyon-lidar.service';
import { PointCloudFile, PointCloudsService, parseRange } from '../services/pointclouds/pointclouds.service';

/**
 * Nuages de points LiDAR : le serveur expose l’en-tête LAS, les flux COPC/LAS en Range et les ressources Potree converties.
 * Le rendu et la lecture de l’octree se font dans le navigateur.
 */
@ApiTags('Nuages de points')
@Controller('pointclouds')
export class PointCloudsController {
  constructor(
    private readonly pointClouds: PointCloudsService,
    private readonly lyonLidar: LyonLidarService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lister les nuages de points disponibles',
    description: 'Fichiers LAS/LAZ, emprise et CRS natifs, ainsi que l’URL Potree si un jeu converti est disponible.',
  })
  @ApiOkResponse({ type: PointCloudListDto })
  async list(): Promise<PointCloudListDto> {
    const files = await this.pointClouds.list();
    return { items: files.map(toDto) };
  }

  @Get('lyon')
  @ApiOperation({
    summary: 'Décrire le LiDAR 2018 de la Métropole de Lyon',
    description: 'Métadonnées de la source EPT, exposée en streaming à la demande.',
  })
  @ApiOkResponse({ type: LyonPointCloudDto })
  async lyonMetadata(): Promise<LyonPointCloudDto> {
    return this.lyonLidar.getMetadata();
  }

  @Get('lyon/ept/*')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Relayer une ressource EPT du LiDAR de Lyon',
    description: 'Proxy en flux des métadonnées, hiérarchies et nœuds LAZ de la source officielle.',
  })
  @ApiOkResponse({ description: 'Ressource EPT diffusée sans téléchargement complet.' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Chemin EPT ou en-tête Range invalide.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async lyonEptAsset(@Req() req: Request, @Res() res: Response): Promise<void> {
    const upstream = await this.lyonLidar.getAsset(req.params[0], req.headers.range);
    res.status(upstream.status);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', contentType(req.params[0]));
    for (const header of ['accept-ranges', 'content-length', 'content-range']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body as NodeReadableStream<Uint8Array>)
      .on('error', () => res.destroy())
      .pipe(res);
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
    const file = await this.pointClouds.getFile(name);
    this.stream(file, req, res);
  }

  @Get(':name/potree/*')
  @SkipThrottle()
  @ApiOperation({
    summary: 'Servir les ressources d’un nuage Potree converti',
    description: 'Ressources cloud.js, octree et hiérarchie depuis POINTCLOUD_DIR/potree/<nom>/. Chaque fichier accepte les requêtes Range.',
  })
  @ApiParam({ name: 'name', example: 'lion_takanawa.copc.laz' })
  @ApiOkResponse({ description: 'Ressource Potree (cloud.js, binaire ou hiérarchie).' })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Nom ou chemin de ressource invalide.' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  async potreeAsset(@Param('name') name: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const assetPath = req.params[0];
    const file = await this.pointClouds.getPotreeAsset(name, assetPath);
    this.stream(file, req, res);
  }

  private stream(file: PointCloudFile, req: Request, res: Response): void {
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
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Range, Content-Length, Last-Modified');
    res.setHeader('Content-Type', contentType(file.name));
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
  const potreeBaseUrl = file.potreeAvailable
    ? `/api/v1/pointclouds/${encodeURIComponent(file.name)}/potree/`
    : null;
  return {
    name: file.name,
    sizeBytes: file.sizeBytes,
    modifiedAt: file.modifiedAt.toISOString(),
    fileUrl: `/api/v1/pointclouds/${encodeURIComponent(file.name)}/file`,
    version: file.header?.version ?? null,
    pointFormat: file.header?.pointFormat ?? null,
    pointCount: file.header?.pointCount ?? null,
    bounds: file.header?.bounds ?? null,
    coordinateSystemWkt: file.header?.coordinateSystemWkt ?? null,
    potreeUrl: potreeBaseUrl ? `${potreeBaseUrl}cloud.js` : null,
    potreeBaseUrl,
  };
}

function contentType(name: string): string {
  switch (extname(name).toLowerCase()) {
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.html': return 'text/html; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.bin':
    case '.hrc':
    case '.laz':
    case '.las': return 'application/octet-stream';
    default: return 'application/octet-stream';
  }
}
