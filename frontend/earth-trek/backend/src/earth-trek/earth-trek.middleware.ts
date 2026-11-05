import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { EarthTrekError } from './earth-trek.core';
import { EARTH_TREK_LAYERS } from './earth-trek.layers';
import { EarthTrekService } from './earth-trek.service';

// Pont avec l'API de tuiles existante : quand le moteur 3D demande une tuile d'un fond du Trek par la route
// générique …/tiles/{couche}/{z}/{x}/{y}, on la sert ici ; toute autre couche continue vers le module de tuiles
// habituel (next). Même chose pour …/tiles/{couche}/attribution.
const ids = EARTH_TREK_LAYERS.map((l) => l.id.replace(/[-]/g, '\\-')).join('|');
const TILE = new RegExp(`/tiles/(${ids})/(\\d+)/(\\d+)/(\\d+)(?:\\.(?:jpg|jpeg|png|webp))?$`);
const ATTRIBUTION = new RegExp(`/tiles/(${ids})/attribution$`);

@Injectable()
export class EarthTrekTilesMiddleware implements NestMiddleware {
  constructor(private readonly trek: EarthTrekService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (req.method !== 'GET') return next();
    const path = (req.originalUrl || req.url || '').split('?')[0];
    if (path.includes('/earth-trek/')) return next(); // routes propres du module : le contrôleur s'en charge

    const tile = TILE.exec(path);
    if (tile) {
      try {
        const result = await this.trek.tile(tile[1], tile[2], tile[3], tile[4]);
        res.setHeader('X-Earth-Trek-Cache', result.cache);
        if (result.status === 204 || !result.body) {
          res.status(204).setHeader('Cache-Control', 'public, max-age=3600');
          res.end();
          return;
        }
        res.setHeader('Content-Type', result.contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.end(result.body);
      } catch (error) {
        const status = error instanceof EarthTrekError ? error.status : 500;
        res.status(status).json({ statusCode: status, message: (error as Error).message });
      }
      return;
    }

    const attribution = ATTRIBUTION.exec(path);
    if (attribution) {
      res.json(this.trek.attribution(attribution[1]));
      return;
    }
    next();
  }
}
