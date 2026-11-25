import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  hashToken,
  SESSION_IDLE_TTL_MS,
  SESSION_TOUCH_INTERVAL_MS,
  SessionService,
} from './session.service.js';

const NOW = new Date('2026-11-25T12:00:00Z');
const user = { id: 'u1', username: 'ana' };

function setup(session: object | null, env: Partial<Env> = {}) {
  const prisma = {
    session: {
      findUnique: vi.fn().mockResolvedValue(session),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = {
    get: (key: keyof Env) => ({ NODE_ENV: 'development', ...env })[key],
  } as unknown as ConfigService<Env, true>;
  const service = new SessionService(
    prisma as unknown as PrismaService,
    config,
  );
  return { service, prisma };
}

const ago = (ms: number) => new Date(NOW.getTime() - ms);
const inFuture = new Date(NOW.getTime() + 60_000);

describe('SessionService', () => {
  it('busca la sesión por el hash del token, nunca por el token', async () => {
    const { service, prisma } = setup(null);
    await service.validate('token-secreto', NOW);
    expect(prisma.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: hashToken('token-secreto') } }),
    );
  });

  it('devuelve el usuario de una sesión vigente sin tocarla si es reciente', async () => {
    const { service, prisma } = setup({
      expiresAt: inFuture,
      lastActiveAt: ago(1000),
      user,
    });
    await expect(service.validate('t', NOW)).resolves.toEqual({
      sessionId: hashToken('t'),
      user,
    });
    expect(prisma.session.updateMany).not.toHaveBeenCalled();
  });

  it('actualiza lastActiveAt si pasó el intervalo', async () => {
    const { service, prisma } = setup({
      expiresAt: inFuture,
      lastActiveAt: ago(SESSION_TOUCH_INTERVAL_MS),
      user,
    });
    await service.validate('t', NOW);
    expect(prisma.session.updateMany).toHaveBeenCalledWith({
      where: { id: hashToken('t') },
      data: { lastActiveAt: NOW },
    });
  });

  it('rechaza y borra una sesión caducada', async () => {
    const { service, prisma } = setup({
      expiresAt: NOW,
      lastActiveAt: ago(1000),
      user,
    });
    await expect(service.validate('t', NOW)).resolves.toBeNull();
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });

  it('rechaza una sesión inactiva demasiado tiempo', async () => {
    const { service } = setup({
      expiresAt: inFuture,
      lastActiveAt: ago(SESSION_IDLE_TTL_MS),
      user,
    });
    await expect(service.validate('t', NOW)).resolves.toBeNull();
  });

  it('usa una cookie __Host- segura en producción', () => {
    const { service } = setup(null, { NODE_ENV: 'production' });
    expect(service.cookieName).toBe('__Host-opinai_sid');
    expect(service.cookieOptions()).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('COOKIE_SECURE=false permite HTTP aunque sea producción', () => {
    const { service } = setup(null, {
      NODE_ENV: 'production',
      COOKIE_SECURE: false,
    });
    expect(service.cookieName).toBe('opinai_sid');
    expect(service.cookieOptions().secure).toBe(false);
  });
});
