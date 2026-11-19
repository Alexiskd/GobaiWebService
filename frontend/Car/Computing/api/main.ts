// Point d'entrée de l'API NestJS : sert les routes consommées par le client de Computing.
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // CORS ouvert : le frontend peut être servi depuis une autre origine.
  const app = await NestFactory.create(AppModule, { cors: true });
  // Port : PORT est fourni par Render ; API_PORT règle un choix local.
  const port = Number(process.env.PORT || process.env.API_PORT || 3000);
  // Hôte : 0.0.0.0 pour être joignable depuis Render (réglable en local par API_HOST=127.0.0.1).
  const host = process.env.API_HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`API Gobai Space prête sur http://${host}:${port}`);
}
bootstrap();
