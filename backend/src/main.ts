import 'dotenv/config';
import { existsSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './modules/app.module';
import { configureApp } from './modules/app.setup';
import { loadConfiguration } from './common/configuration';
import { setupOpenApi } from './modules/openapi';
import { P2PSignalingService } from './services/contributions/p2p-signaling.service';

/**
 * Service web unique : l'API sert aussi le site compilé (frontend/dist), sur la même origine.
 * Fichiers de Vite sous /assets (noms hachés) : cache d'un an ; index.html : jamais mis en cache.
 * Toute autre route GET hors /api renvoie index.html (application monopage).
 * Dossier réglable avec FRONTEND_DIST ; absent (développement avec Vite), seule l'API est servie.
 */
function serveFrontend(app: NestExpressApplication): string | null {
  const dir = resolve(process.env.FRONTEND_DIST?.trim() || join(__dirname, '..', '..', 'frontend', 'dist'));
  const index = join(dir, 'index.html');
  if (!existsSync(index)) return null;

  app.useStaticAssets(dir, {
    index: false,
    setHeaders: (res, filePath) => {
      const hashed = filePath.includes(`${sep}assets${sep}`);
      res.setHeader('Cache-Control', hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600');
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isApi = req.path === '/api' || req.path.startsWith('/api/');
    // Un fichier introuvable (extension présente) reste une 404 : pas d'index.html à la place d'un script.
    if ((req.method !== 'GET' && req.method !== 'HEAD') || isApi || extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return dir;
}

async function bootstrap() {
  const config = loadConfiguration();
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const site = serveFrontend(app);
  configureApp(app, config);
  setupOpenApi(app);
  app.get(P2PSignalingService).attach(app.getHttpServer());
  await app.listen(config.port);
  if (site) console.log(`Site      : http://localhost:${config.port}/  (${site})`);
  else console.log('Site      : frontend/dist absent, API seule (lancez « npm run build » à la racine)');
  console.log(`API       : http://localhost:${config.port}/api/v1`);
  console.log(`Docs      : http://localhost:${config.port}/api/docs`);
}
bootstrap();
