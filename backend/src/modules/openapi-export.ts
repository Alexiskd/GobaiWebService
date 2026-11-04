import 'dotenv/config';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { loadConfiguration } from '../common/configuration';
import { buildOpenApiDocument } from './openapi';

/** `npm run openapi:export` → écrit `openapi.json` (sans démarrer le serveur), utile pour générer un client. */
async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app, loadConfiguration());
  await app.init();
  const file = join(process.cwd(), 'openapi.json');
  writeFileSync(file, JSON.stringify(buildOpenApiDocument(app), null, 2));
  await app.close();
  console.log(`OpenAPI écrit : ${file}`);
}
exportOpenApi();
