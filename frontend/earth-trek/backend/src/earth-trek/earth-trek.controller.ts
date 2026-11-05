import { Controller, Get, HttpException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { EarthTrekError } from './earth-trek.core';
import { EarthTrekService } from './earth-trek.service';

// Routes (avec le préfixe global api/v1) :
//   GET /api/v1/earth-trek/layers                     fonds disponibles (sans clé ni URL fournisseur)
//   GET /api/v1/earth-trek/stops                      étapes du trek
//   GET /api/v1/earth-trek/layers/:layer/attribution  mention de source
//   GET /api/v1/earth-trek/tiles/:layer/:z/:x/:y      tuile (proxy + cache)
@Controller('earth-trek')
export class EarthTrekController {
  constructor(private readonly trek: EarthTrekService) {}

  @Get('layers')
  layers() {
    return { body: 'earth', items: this.trek.layers() };
  }

  @Get('stops')
  stops() {
    return { items: this.trek.stops() };
  }

  @Get('cache')
  cache() {
    return this.trek.cacheStats();
  }

  @Get('layers/:layer/attribution')
  attribution(@Param('layer') layer: string) {
    return this.guard(() => this.trek.attribution(layer));
  }

  @Get('tiles/:layer/:z/:x/:y')
  async tile(
    @Param('layer') layer: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.guardAsync(() => this.trek.tile(layer, z, x, y));
    res.setHeader('X-Earth-Trek-Cache', result.cache);
    if (result.status === 204 || !result.body) {
      res.status(204).setHeader('Cache-Control', 'public, max-age=3600');
      return undefined;
    }
    res.setHeader('Content-Type', result.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return new StreamableFile(result.body);
  }

  private guard<T>(fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private async guardAsync<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.toHttp(error);
    }
  }

  private toHttp(error: unknown) {
    if (error instanceof EarthTrekError) return new HttpException({ statusCode: error.status, message: error.message }, error.status);
    return new HttpException({ statusCode: 500, message: 'Erreur interne du Trek de la Terre.' }, 500);
  }
}
