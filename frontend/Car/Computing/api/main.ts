// Point d'entrée de l'API NestJS : sert les routes consommées par le client de Computing.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // CORS ouvert : le frontend peut être servi depuis une autre origine.
  const app = await NestFactory.create(AppModule, { cors: true });
  // Hôte et port réglables : 127.0.0.1 par défaut, port lu dans API_PORT.
  const port = Number(process.env.API_PORT || 3000);
  const host = process.env.API_HOST || '127.0.0.1';
  await app.listen(port, host);
  console.log(`API Gobai Space prête sur http://${host}:${port}`);
}
bootstrap();
