import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

const BASE_URL = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 8000;
// Español de Chile; TMDB cae a otras variantes del español si no hay traducción
export const TMDB_LANGUAGE = 'es-CL';

// Cliente HTTP de TMDB. El token nunca sale del back.
@Injectable()
export class TmdbClient {
  private readonly logger = new Logger(TmdbClient.name);
  private readonly token?: string;

  constructor(config: ConfigService<Env, true>) {
    this.token = config.get('TMDB_ACCESS_TOKEN', { infer: true });
  }

  get configured(): boolean {
    return Boolean(this.token);
  }

  async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {},
  ): Promise<T> {
    if (!this.token) {
      throw new ServiceUnavailableException(
        'La integración con TMDB no está configurada (falta TMDB_ACCESS_TOKEN)',
      );
    }

    const url = new URL(BASE_URL + path);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`TMDB no respondió (${path}): ${String(error)}`);
      throw new ServiceUnavailableException('No se pudo conectar con TMDB');
    }

    if (response.ok) return (await response.json()) as T;

    if (response.status === 404) {
      throw new NotFoundException('No existe en TMDB');
    }
    if (response.status === 429) {
      throw new HttpException(
        'TMDB está limitando las peticiones; prueba de nuevo en unos segundos',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (response.status === 401) {
      this.logger.error('TMDB rechazó el token: revisa TMDB_ACCESS_TOKEN');
    } else {
      this.logger.error(`TMDB respondió ${response.status} en ${path}`);
    }
    throw new ServiceUnavailableException('TMDB no está disponible ahora');
  }
}
