import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Env } from '../../config/env.js';
import { UserRole } from '../../generated/prisma/client.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import type { SessionService } from '../session.service.js';
import { OriginGuard } from './origin.guard.js';
import { SessionGuard } from './session.guard.js';

function context(req: object, metadata: Record<string, unknown> = {}) {
  const handler = () => undefined;
  Object.entries(metadata).forEach(([key, value]) =>
    Reflect.defineMetadata(key, value, handler),
  );
  const res = { clearCookie: vi.fn() };
  const ctx = {
    getType: () => 'http',
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
  } as unknown as ExecutionContext;
  return { ctx, res };
}

describe('OriginGuard', () => {
  const config = {
    get: () => ['http://localhost:5173'],
  } as unknown as ConfigService<Env, true>;
  const guard = new OriginGuard(config);
  const check = (method: string, origin?: string) =>
    guard.canActivate(context({ method, headers: { origin } }).ctx);

  it('deja pasar métodos de lectura desde cualquier origen', () => {
    expect(check('GET', 'https://otro.com')).toBe(true);
  });

  it('deja pasar escrituras desde un origen de confianza o sin Origin', () => {
    expect(check('POST', 'http://localhost:5173')).toBe(true);
    expect(check('DELETE')).toBe(true);
  });

  it('rechaza escrituras desde otro origen', () => {
    expect(() => check('POST', 'https://malicioso.com')).toThrow(
      ForbiddenException,
    );
  });
});

describe('SessionGuard', () => {
  const user = { id: 'u1', role: UserRole.USER };

  function setup(validSession: boolean) {
    const sessions = {
      cookieName: 'opinai_sid',
      cookieOptions: () => ({}),
      validate: vi
        .fn()
        .mockResolvedValue(validSession ? { sessionId: 's1', user } : null),
    } as unknown as SessionService;
    return new SessionGuard(new Reflector(), sessions);
  }

  it('exige sesión en rutas no públicas', async () => {
    const { ctx } = context({ cookies: {} });
    await expect(setup(false).canActivate(ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('carga el usuario de una sesión válida', async () => {
    const req: Record<string, unknown> = { cookies: { opinai_sid: 'tok' } };
    await expect(setup(true).canActivate(context(req).ctx)).resolves.toBe(true);
    expect(req.user).toBe(user);
    expect(req.sessionId).toBe('s1');
  });

  it('permite rutas públicas sin sesión y borra una cookie inválida', async () => {
    const { ctx, res } = context(
      { cookies: { opinai_sid: 'caducado' } },
      { [IS_PUBLIC_KEY]: true },
    );
    await expect(setup(false).canActivate(ctx)).resolves.toBe(true);
    expect(res.clearCookie).toHaveBeenCalled();
  });

  it('rechaza con 403 si falta el rol requerido', async () => {
    const { ctx } = context(
      { cookies: { opinai_sid: 'tok' } },
      { [ROLES_KEY]: [UserRole.ADMIN] },
    );
    await expect(setup(true).canActivate(ctx)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
