import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const API_URL = 'https://api.igdb.com/v4';
const TIMEOUT_MS = 8000;
// Se renueva el token un día antes de que caduque (duran ~60 días)
const RENEW_MARGIN_MS = 24 * 60 * 60 * 1000;

interface CachedToken {
  value: string;
  expiresAt: number;
}

// Cliente de IGDB. Autentica con las credenciales de la app de Twitch
// (client credentials): pide un token, lo guarda en memoria y lo renueva
// cuando está por caducar o si IGDB lo rechaza. Ni el secret ni el token
// salen del back.
@Injectable()
export class IgdbClient {
  private readonly logger = new Logger(IgdbClient.name);
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private token?: CachedToken;
  // Si varias peticiones necesitan token a la vez, comparten la misma solicitud
  private pendingToken?: Promise<string>;

  constructor(config: ConfigService<Env, true>) {
    this.clientId = config.get('IGDB_CLIENT_ID', { infer: true });
    this.clientSecret = config.get('IGDB_CLIENT_SECRET', { infer: true });
  }

  // Consulta en el lenguaje de IGDB (Apicalypse): 'fields name; where id = 1;'
  // Devuelve las filas y el total que informa la cabecera X-Count.
  async query<T>(
    endpoint: string,
    body: string,
  ): Promise<{ rows: T[]; total: number }> {
    let response = await this.send(endpoint, body, await this.getToken());
    if (response.status === 401) {
      // Token revocado o caducado antes de tiempo: se pide otro y se reintenta
      this.token = undefined;
      response = await this.send(endpoint, body, await this.getToken());
    }

    if (response.ok) {
      const rows = (await response.json()) as T[];
      const total = Number(response.headers.get('x-count') ?? rows.length);
      return { rows, total };
    }
    if (response.status === 429) {
      throw new HttpException(
        'IGDB está limitando las peticiones; prueba de nuevo en unos segundos',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    // 400 = consulta mal formada: es un error nuestro, se registra entero
    this.logger.error(
      `IGDB respondió ${response.status} en /${endpoint}: ${await response.text()}`,
    );
    throw new ServiceUnavailableException('IGDB no está disponible ahora');
  }

  private async send(endpoint: string, body: string, token: string) {
    try {
      return await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Client-ID': this.clientId!,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'text/plain',
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(`IGDB no respondió (/${endpoint}): ${String(error)}`);
      throw new ServiceUnavailableException('No se pudo conectar con IGDB');
    }
  }

  private async getToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new ServiceUnavailableException(
        'La integración con IGDB no está configurada (faltan IGDB_CLIENT_ID e IGDB_CLIENT_SECRET)',
      );
    }
    if (this.token && this.token.expiresAt - RENEW_MARGIN_MS > Date.now()) {
      return this.token.value;
    }
    this.pendingToken ??= this.requestToken().finally(() => {
      this.pendingToken = undefined;
    });
    return this.pendingToken;
  }

  private async requestToken(): Promise<string> {
    let response: Response;
    try {
      response = await fetch(TOKEN_URL, {
        method: 'POST',
        // En el cuerpo, no en la URL, para que el secret no quede en logs
        body: new URLSearchParams({
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
          grant_type: 'client_credentials',
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      this.logger.warn(
        `Twitch no respondió al pedir el token: ${String(error)}`,
      );
      throw new ServiceUnavailableException('No se pudo conectar con IGDB');
    }
    if (!response.ok) {
      this.logger.error(
        `Twitch rechazó las credenciales de IGDB (${response.status}): revisa IGDB_CLIENT_ID e IGDB_CLIENT_SECRET`,
      );
      throw new ServiceUnavailableException('IGDB no está disponible ahora');
    }
    const body = (await response.json()) as {
      access_token: string;
      expires_in: number; // segundos
    };
    this.token = {
      value: body.access_token,
      expiresAt: Date.now() + body.expires_in * 1000,
    };
    return body.access_token;
  }
}
