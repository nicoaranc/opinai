// Carga .env antes que nada: ObserveModule lee process.env al importarse.
// La validación de las variables la hace ConfigModule (src/config/env.ts).
import 'dotenv/config';
import { Logger, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { AppModule, ObserveInstrument } from './app.module.js';
import type { Env } from './config/env.js';

// Mensajes de validación de Zod en español
z.config(z.locales.es());

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Todas las rutas cuelgan de /api (el front redirige /api/* al back)
  app.setGlobalPrefix('api');
  // Detrás de un proxy (Render), para que req.ip sea la IP real del cliente
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  app.set('trust proxy', trustProxy);
  if (config.get('NODE_ENV', { infer: true }) === 'production' && !trustProxy) {
    // Detrás de Render todas las peticiones llegarían con la IP del proxy y
    // el rate limit se compartiría entre todos los usuarios
    new Logger('Bootstrap').warn(
      'TRUST_PROXY=0 en producción: el rate limit verá la IP del proxy, no la del cliente.',
    );
  }
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
  });
  // Valida solo los parámetros que declaran `{ schema }` (Zod)
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.enableShutdownHooks();

  // Documentación OpenAPI en /api/docs (solo fuera de producción). Los
  // esquemas de entrada salen de los mismos esquemas Zod que validan.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('opinai API')
        .setDescription(
          'Reseñas de películas, series, música y videojuegos. ' +
            'Las rutas con sesión usan la cookie que devuelve POST /api/auth/login.',
        )
        .setVersion('0.1')
        .addCookieAuth('opinai_sid')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
