import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { UserRole } from '../../generated/prisma/client.js';
import type { AuthenticatedRequest } from '../auth.types.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { SessionService } from '../session.service.js';

// Guard global: todas las rutas exigen sesión salvo las marcadas con @Public().
// @Roles(...) exige además uno de esos roles.
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const http = context.switchToHttp();
    const req = http.getRequest<AuthenticatedRequest>();
    const targets = [context.getHandler(), context.getClass()];

    const cookies = req.cookies as Record<string, unknown> | undefined;
    const token = cookies?.[this.sessions.cookieName];
    if (typeof token === 'string' && token) {
      const session = await this.sessions.validate(token);
      if (session) {
        req.user = session.user;
        req.sessionId = session.sessionId;
      } else {
        // Cookie caducada o revocada: se borra del navegador
        http
          .getResponse<Response>()
          .clearCookie(this.sessions.cookieName, this.sessions.cookieOptions());
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      targets,
    );
    if (!req.user) {
      if (isPublic) return true;
      throw new UnauthorizedException('Debes iniciar sesión');
    }

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      targets,
    );
    if (roles?.length && !roles.includes(req.user.role)) {
      throw new ForbiddenException('No tienes permiso para esta acción');
    }
    return true;
  }
}
