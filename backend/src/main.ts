import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './modules/app.module';
import { configureApp } from './modules/app.setup';
import { loadConfiguration } from './common/configuration';
import { setupOpenApi } from './modules/openapi';

async function bootstrap() {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule);
  configureApp(app, config);
  setupOpenApi(app);
  await app.listen(config.port);
  console.log(`API       : http://localhost:${config.port}/api/v1`);
  console.log(`Docs      : http://localhost:${config.port}/api/docs`);
}
bootstrap();
