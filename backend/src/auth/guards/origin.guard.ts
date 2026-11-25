import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Protección CSRF: las peticiones que modifican datos desde un navegador deben
// venir de un origen de confianza. Complementa a la cookie SameSite=Lax.
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly trusted: Set<string>;

  constructor(config: ConfigService<Env, true>) {
    this.trusted = new Set(config.get('CORS_ORIGINS', { infer: true }));
  }

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;

    const origin = req.headers.origin;
    // Sin Origin no es un navegador (curl, apps), que siempre lo envía en estos métodos
    if (!origin || this.trusted.has(origin)) return true;
    throw new ForbiddenException('Origen no permitido');
  }
}
