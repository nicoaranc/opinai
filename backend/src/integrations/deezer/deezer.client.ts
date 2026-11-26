import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { DeezerErrorBody } from './deezer.types.js';

const BASE_URL = 'https://api.deezer.com';
const TIMEOUT_MS = 8000;

// Códigos de error de Deezer (llegan con HTTP 200 en el cuerpo)
const NOT_FOUND = 800;
const QUOTA_EXCEEDED = 4;

// Cliente de la API pública de Deezer: no necesita clave ni registro.
// Límite: ~50 peticiones cada 5 segundos por IP.
@Injectable()
export class DeezerClient {
  private readonly logger = new Logger(DeezerClient.name);

  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    const url = new URL(BASE_URL + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`Deezer no respondió (${path}): ${String(error)}`);
      throw new ServiceUnavailableException('No se pudo conectar con Deezer');
    }
    if (!response.ok) {
      this.logger.error(`Deezer respondió ${response.status} en ${path}`);
      throw new ServiceUnavailableException('Deezer no está disponible ahora');
    }

    const body = (await response.json()) as T | DeezerErrorBody;
    if (body && typeof body === 'object' && 'error' in body) {
      const { code, message } = body.error;
      if (code === NOT_FOUND)
        throw new NotFoundException('No existe en Deezer');
      if (code === QUOTA_EXCEEDED) {
        throw new HttpException(
          'Deezer está limitando las peticiones; prueba de nuevo en unos segundos',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }
      this.logger.error(`Error de Deezer en ${path}: ${code} ${message}`);
      throw new ServiceUnavailableException('Deezer no está disponible ahora');
    }
    return body;
  }
}
