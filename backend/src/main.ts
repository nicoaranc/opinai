// Carga .env antes que nada: ObserveModule lee process.env al importarse.
// La validación de las variables la hace ConfigModule (src/config/env.ts).
import 'dotenv/config';
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  // Valida solo los parámetros que declaran `{ schema }` (Zod)
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
